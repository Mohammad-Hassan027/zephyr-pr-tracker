/**
 * Integration smoke tests for Health and Readiness probes (/healthz & /readyz).
 * Tests liveness, dependency readiness, failure states, secret redaction, and headers.
 */

import assert from "node:assert";
import http from "node:http";
import process from "node:process";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb } from "./setup-test-db.js";

// Ensure test environment variables
process.env.PORT = "0";
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "super-secret-key-at-least-32-chars-long!!";
process.env.PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || "platform-admin-test-password";

import server from "../server.js";

let baseURL = "";
let serverInstance = null;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseURL);
    const reqOptions = {
      method: options.method || "GET",
      headers: options.headers || {},
    };

    const req = http.request(url, reqOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let body;
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
        resolve({ status: res.statusCode, body, headers: res.headers });
      });
    });

    req.on("error", reject);

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function test(name, fn) {
  return fn()
    .then(() => console.log(`✔ ${name}`))
    .catch((err) => {
      console.error(`✖ ${name}`);
      console.error(err);
      process.exit(1);
    });
}

async function runHealthTests() {
  await setupTestDb();

  await new Promise((resolve) => {
    serverInstance = server.listen(0, () => {
      const port = serverInstance.address().port;
      baseURL = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  console.log("\n=== RUNNING HEALTH & READINESS PROBE INTEGRATION TESTS ===");

  try {
    // 1. /healthz returns 200 without authentication
    await test("GET /healthz returns 200 with live status and no-store headers without authentication", async () => {
      const res = await request("/healthz");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.service, "zephyr-backend");
      assert.strictEqual(res.body.status, "live");
      assert(
        res.headers["cache-control"]?.includes("no-store"),
        "Expected Cache-Control header to contain 'no-store'",
      );
    });

    // 2. /api/healthz alias returns 200
    await test("GET /api/healthz alias returns 200 with live status", async () => {
      const res = await request("/api/healthz");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.status, "live");
    });

    // 3. /readyz returns 200 when MongoDB is connected and config is valid
    await test("GET /readyz returns 200 when database and configuration are healthy", async () => {
      const res = await request("/readyz");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.ok, true);
      assert.strictEqual(res.body.service, "zephyr-backend");
      assert.strictEqual(res.body.status, "ready");
      assert.deepStrictEqual(res.body.checks, {
        database: "connected",
        configuration: "valid",
      });
      assert(
        res.headers["cache-control"]?.includes("no-store"),
        "Expected Cache-Control header to contain 'no-store'",
      );
    });

    // 4. Responses do not contain secrets or sensitive configuration
    await test("Health and readiness responses do not expose secrets or connection strings", async () => {
      const [resHealth, resReady] = await Promise.all([
        request("/healthz"),
        request("/readyz"),
      ]);

      const healthString = JSON.stringify(resHealth.body);
      const readyString = JSON.stringify(resReady.body);

      assert(!healthString.includes(process.env.AUTH_SECRET), "Health response leaked AUTH_SECRET");
      assert(!healthString.includes(process.env.PLATFORM_ADMIN_PASSWORD), "Health response leaked PLATFORM_ADMIN_PASSWORD");
      assert(!healthString.includes("mongodb"), "Health response leaked mongodb connection details");

      assert(!readyString.includes(process.env.AUTH_SECRET), "Ready response leaked AUTH_SECRET");
      assert(!readyString.includes(process.env.PLATFORM_ADMIN_PASSWORD), "Ready response leaked PLATFORM_ADMIN_PASSWORD");
      assert(!readyString.includes("mongodb"), "Ready response leaked mongodb connection details");
    });

    // 5. /readyz returns 503 when MongoDB is disconnected
    await test("GET /readyz returns 503 when database is disconnected", async () => {
      const originalReadyState = mongoose.connection.readyState;
      Object.defineProperty(mongoose.connection, "readyState", {
        value: 0,
        writable: true,
        configurable: true,
      });

      try {
        const res = await request("/readyz");
        assert.strictEqual(res.status, 503);
        assert.strictEqual(res.body.ok, false);
        assert.strictEqual(res.body.status, "not_ready");
        assert.strictEqual(res.body.checks.database, "disconnected");
      } finally {
        Object.defineProperty(mongoose.connection, "readyState", {
          value: originalReadyState,
          writable: true,
          configurable: true,
        });
      }
    });

    // 6. /readyz returns 503 when required environment configuration is missing
    await test("GET /readyz returns 503 when required environment configuration is missing", async () => {
      const originalSecret = process.env.AUTH_SECRET;
      delete process.env.AUTH_SECRET;

      try {
        const res = await request("/readyz");
        assert.strictEqual(res.status, 503);
        assert.strictEqual(res.body.ok, false);
        assert.strictEqual(res.body.status, "not_ready");
        assert.strictEqual(res.body.checks.configuration, "invalid");
      } finally {
        process.env.AUTH_SECRET = originalSecret;
      }
    });

    // 7. /healthz continues to return 200 even when database is disconnected and config is missing
    await test("GET /healthz remains 200 even under database outage and config degradation", async () => {
      const originalReadyState = mongoose.connection.readyState;
      const originalSecret = process.env.AUTH_SECRET;
      Object.defineProperty(mongoose.connection, "readyState", {
        value: 0,
        writable: true,
        configurable: true,
      });
      delete process.env.AUTH_SECRET;

      try {
        const res = await request("/healthz");
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.ok, true);
        assert.strictEqual(res.body.status, "live");
      } finally {
        Object.defineProperty(mongoose.connection, "readyState", {
          value: originalReadyState,
          writable: true,
          configurable: true,
        });
        process.env.AUTH_SECRET = originalSecret;
      }
    });

    console.log("\n=== ALL HEALTH & READINESS PROBE TESTS PASSED ===");
  } finally {
    if (serverInstance) {
      if (typeof serverInstance.closeAllConnections === "function") {
        serverInstance.closeAllConnections();
      }
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await teardownTestDb();
  }
}

runHealthTests().catch((err) => {
  console.error("Health Probe Test Failed:", err);
  process.exit(1);
});

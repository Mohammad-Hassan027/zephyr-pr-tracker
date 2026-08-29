/**
 * Integration smoke tests for HTTP authentication & authorization middleware.
 * Tests route protection, role verification, and access controls across end-points.
 */

import assert from "node:assert";
import http from "node:http";
import process from "node:process";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb } from "./setup-test-db.js";

// Set environment for test before imports
process.env.PORT = "0"; // random free port
process.env.AUTH_SECRET = process.env.AUTH_SECRET || "super-secret-key-at-least-32-chars-long!!";
process.env.PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || "platform-admin-test-password";

import server from "../server.js";
import PRMember from "../models/PRMember.js";
import { createSessionToken } from "../auth/session.service.js";

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

async function runSmokeTests() {
  await setupTestDb();

  await new Promise((resolve) => {
    serverInstance = server.listen(0, () => {
      const port = serverInstance.address().port;
      baseURL = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  console.log("\n=== RUNNING AUTH & AUTHORIZATION ROUTE SMOKE TESTS ===");

  const club1Id = new mongoose.Types.ObjectId().toString();

  const validClub1Token = createSessionToken({ role: "club", clubId: club1Id, clubSlug: "club-1" });
  const validPRToken = createSessionToken({ role: "pr", code: "PR999", clubId: club1Id });
  const validPlatformAdminToken = createSessionToken({ role: "platform_admin" });

  PRMember.findOne = async (query) => {
    if (query && query.code === "PR999") {
      return { code: "PR999", club: club1Id };
    }
    return null;
  };

  try {
    // 1. Missing Token Rejection (401)
    await test("Protected route rejects missing token with 401", async () => {
      const res = await request("/api/clubs/me");
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, "Authentication required");
    });

    // 2. Malformed Token Rejection (401)
    await test("Protected route rejects malformed token with 401", async () => {
      const res = await request("/api/clubs/me", {
        headers: { Authorization: "Bearer bad.token.here" },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, "Authentication required");
    });

    // 3. Expired Token Rejection (401)
    await test("Protected route rejects expired token with 401", async () => {
      const past = Math.floor(Date.now() / 1000) - 100;
      const expiredToken = createSessionToken({ role: "club", clubId: club1Id, iat: past - 3600, exp: past });
      const res = await request("/api/clubs/me", {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, "Authentication required");
    });

    // 4. Role Authorization: PR Member attempting Club Admin endpoint (403)
    await test("PR Member access to Club Admin endpoint returns 403", async () => {
      const res = await request("/api/clubs/me", {
        headers: { Authorization: `Bearer ${validPRToken}` },
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, "Club admin access required");
    });

    // 5. Role Authorization: PR Member attempting Event Creation (403)
    await test("PR Member creating event returns 403", async () => {
      const res = await request("/api/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validPRToken}`,
          "Content-Type": "application/json",
        },
        body: { name: "Test Event", slug: "test-event" },
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, "Club admin access required");
    });

    // 6. Role Authorization: PR Member self-service PIN change authorization
    await test("Non-PR Member trying /change-pin endpoint fails validation", async () => {
      const res = await request("/api/members/change-pin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${validClub1Token}`,
          "Content-Type": "application/json",
        },
        body: { newPin: "1234" },
      });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, "Only PR members can use this endpoint");
    });

    // 7. Platform Admin Authorization
    await test("Platform Admin endpoint rejects regular club token with 403", async () => {
      const res = await request("/api/clubs/pending", {
        headers: { Authorization: `Bearer ${validClub1Token}` },
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error, "Platform admin access required");
    });

    await test("Platform Admin endpoint accepts platform admin token", async () => {
      const res = await request("/api/clubs/pending", {
        headers: { Authorization: `Bearer ${validPlatformAdminToken}` },
      });
      assert.strictEqual(res.status, 200);
    });

    console.log("\n=== ALL AUTH ROUTE SMOKE TESTS PASSED ===");
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

runSmokeTests().catch((err) => {
  console.error("Auth Route Smoke Test Failed:", err);
  process.exit(1);
});

import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb } from "./setup-test-db.js";
import validateEnv from "../config/env.js";
import errorHandler from "../middleware/errorHandler.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ProviderError,
  DatabaseError,
} from "../utils/errors.js";

async function runPhase0Tests() {
  console.log("=== RUNNING PHASE 0 RELEASE-BLOCKER REMEDIATION TEST SUITE ===");

  // Set default safe test credentials
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "super-secret-key-for-test-at-least-32-chars-long!";
  process.env.PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD || "platform-admin-test-password";
  process.env.NODE_ENV = "production"; // Test safe serialization in production mode

  // 1. Startup Configuration Validation Tests
  console.log("\n[Test 1] Startup Configuration Validation Failure & Redaction");

  assert.throws(
    () => {
      const origSecret = process.env.AUTH_SECRET;
      try {
        process.env.AUTH_SECRET = "too-short";
        validateEnv({ isTest: true });
      } finally {
        process.env.AUTH_SECRET = origSecret;
      }
    },
    (err) => {
      assert.ok(err.diagnosticMessage.includes("AUTH_SECRET must be at least 32 characters long"));
      assert.ok(!err.diagnosticMessage.includes(process.env.AUTH_SECRET)); // Never leak original secret
      return true;
    }
  );

  assert.throws(
    () => {
      const origPassword = process.env.PLATFORM_ADMIN_PASSWORD;
      try {
        delete process.env.PLATFORM_ADMIN_PASSWORD;
        validateEnv({ isTest: true });
      } finally {
        process.env.PLATFORM_ADMIN_PASSWORD = origPassword;
      }
    },
    (err) => {
      assert.ok(err.diagnosticMessage.includes("PLATFORM_ADMIN_PASSWORD is required but missing"));
      return true;
    }
  );

  assert.throws(
    () => {
      const origOrigin = process.env.CLIENT_ORIGIN;
      try {
        process.env.CLIENT_ORIGIN = "not-a-valid-url-format";
        validateEnv({ isTest: true });
      } finally {
        process.env.CLIENT_ORIGIN = origOrigin;
      }
    },
    (err) => {
      assert.ok(err.diagnosticMessage.includes("is not a valid URL"));
      return true;
    }
  );
  console.log("✔ Startup configuration validation and redacted diagnostics verified!");

  // 2. Setup Hermetic HTTP Test Server
  const app = express();
  app.use(express.json());

  // Test routes for error serialization
  app.get("/test/syntax-error", (_req, _res, _next) => {
    const err = new SyntaxError("Unexpected token in JSON");
    err.status = 400;
    err.body = "{ bad }";
    throw err;
  });

  app.get("/test/validation-error", (_req, _res, next) => {
    const err = new Error("Validation failed");
    err.name = "ValidationError";
    err.errors = { email: { message: "Email is invalid format" } };
    next(err);
  });

  app.get("/test/cast-error", (_req, _res, next) => {
    const err = new Error("Cast error");
    err.name = "CastError";
    err.path = "clubId";
    next(err);
  });

  app.get("/test/duplicate-error", (_req, _res, next) => {
    const err = new Error("E11000 duplicate key error");
    err.code = 11000;
    err.keyValue = { slug: "duplicate-club" };
    next(err);
  });

  app.get("/test/db-outage", (_req, _res, next) => {
    const err = new Error("MongoNetworkError: failed to connect to server [localhost:27017]");
    err.name = "MongoNetworkError";
    next(err);
  });

  app.get("/test/typed-conflict", (_req, _res, next) => {
    next(new ConflictError("Registration already reviewed"));
  });

  app.get("/test/unexpected-crash", (_req, _res, next) => {
    next(new Error("Database connection password=secret_pw_123 failed at line 42"));
  });

  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 3. Malformed JSON Request Handling
    console.log("\n[Test 2] Malformed Request & JSON Syntax Error");
    const jsonRes = await fetch(`${baseUrl}/test/syntax-error`);
    assert.equal(jsonRes.status, 400);
    const jsonBody = await jsonRes.json();
    assert.equal(jsonBody.code, "INVALID_JSON");
    assert.equal(jsonBody.error, "Invalid JSON payload");
    console.log("✔ Malformed JSON handled safely with 400 INVALID_JSON!");

    // 4. Mongoose Validation Error Handling
    console.log("\n[Test 3] Mongoose Validation Error Formatting");
    const valRes = await fetch(`${baseUrl}/test/validation-error`);
    assert.equal(valRes.status, 400);
    const valBody = await valRes.json();
    assert.equal(valBody.code, "VALIDATION_ERROR");
    assert.equal(valBody.details?.email, "Email is invalid format");
    console.log("✔ Mongoose validation error formatted with field details!");

    // 5. CastError Invalid ObjectId Format Handling
    console.log("\n[Test 4] CastError / Invalid ID Format");
    const castRes = await fetch(`${baseUrl}/test/cast-error`);
    assert.equal(castRes.status, 400);
    const castBody = await castRes.json();
    assert.equal(castBody.code, "INVALID_ID");
    assert.ok(castBody.error.includes("Invalid ID format for field 'clubId'"));
    console.log("✔ Invalid ID format handled with 400 INVALID_ID!");

    // 6. Duplicate Key Record Conflict (Code 11000)
    console.log("\n[Test 5] Duplicate Record Conflict (Code 11000)");
    const dupRes = await fetch(`${baseUrl}/test/duplicate-error`);
    assert.equal(dupRes.status, 409);
    const dupBody = await dupRes.json();
    assert.equal(dupBody.code, "DUPLICATE_KEY_ERROR");
    assert.ok(dupBody.error.includes("Duplicate record conflict"));
    console.log("✔ Duplicate record conflict returned 409 DUPLICATE_KEY_ERROR!");

    // 7. Database Outage / Network Error Handling
    console.log("\n[Test 6] Database Network Outage Handling");
    const dbRes = await fetch(`${baseUrl}/test/db-outage`);
    assert.equal(dbRes.status, 503);
    const dbBody = await dbRes.json();
    assert.equal(dbBody.code, "SERVICE_UNAVAILABLE");
    assert.equal(dbBody.error, "Service unavailable");
    assert.equal(dbBody.stack, undefined); // Stack trace must NOT be exposed
    console.log("✔ Database outage returned generic 503 without leaking traces or URIs!");

    // 8. Typed Conflict Error Serialization
    console.log("\n[Test 7] Typed Conflict Error Serialization");
    const conflictRes = await fetch(`${baseUrl}/test/typed-conflict`);
    assert.equal(conflictRes.status, 409);
    const conflictBody = await conflictRes.json();
    assert.equal(conflictBody.code, "CONFLICT_ERROR");
    assert.equal(conflictBody.error, "Registration already reviewed");
    console.log("✔ Typed ConflictError returned 409 CONFLICT_ERROR!");

    // 9. Safe Unexpected Error Serialization (No stack traces or secrets in production)
    console.log("\n[Test 8] Safe Unexpected Error Serialization in Production");
    const crashRes = await fetch(`${baseUrl}/test/unexpected-crash`);
    assert.equal(crashRes.status, 500);
    const crashBody = await crashRes.json();
    assert.equal(crashBody.code, "INTERNAL_SERVER_ERROR");
    assert.equal(crashBody.error, "An internal server error occurred"); // Message sanitized in production
    assert.equal(crashBody.stack, undefined);
    assert.ok(!JSON.stringify(crashBody).includes("secret_pw_123")); // No secrets leaked
    console.log("✔ Unexpected crash in production mode returned safe sanitized 500 without secret leakage!");

    // 10. Integration DB Test via MongoMemoryServer
    console.log("\n[Test 9] Hermetic Integration DB Operations");
    await setupTestDb();
    assert.equal(mongoose.connection.readyState, 1);
    console.log("✔ Connected hermetically to MongoMemoryServer!");
    await teardownTestDb();
    console.log("✔ Closed hermetic test database connection!");

    console.log("\n=== ALL PHASE 0 REMEDIATION TESTS PASSED SUCCESSFULLY ===");
  } finally {
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

runPhase0Tests().catch((err) => {
  console.error("Phase 0 Test Suite Failed:", err);
  process.exit(1);
});

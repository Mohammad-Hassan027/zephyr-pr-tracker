import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { createSessionToken } from "../utils/auth.js";
import registrationRoutes from "../routes/registrations.js";

// Disable command buffering so queries fail immediately when not connected to MongoDB
mongoose.set("bufferCommands", false);

async function runRouteSmokeTests() {
  console.log("=== RUNNING REGISTRATION ROUTES SMOKE TESTS ===");

  const validToken = createSessionToken({
    role: "club",
    clubId: "60d5ecb8b5c9c22b1c8c1111",
    clubSlug: "test-club",
  });

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${validToken}`,
    Connection: "close",
  };

  const app = express();
  app.use(express.json());
  app.use("/api/registrations", registrationRoutes);

  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/registrations`;

  try {
    // 1. GET /upload-signature
    console.log("\n[Smoke Test 1] GET /upload-signature");
    const sigRes = await fetch(`${baseUrl}/upload-signature`, {
      headers: { Connection: "close" },
    });
    assert.ok([200, 500].includes(sigRes.status));
    const sigBody = await sigRes.json();
    assert.ok(sigBody.signature || sigBody.error);
    console.log(`✔ Upload signature route responded (status ${sigRes.status})`);

    // 2. POST /check-duplicate (validation error)
    console.log("\n[Smoke Test 2] POST /check-duplicate (validation error)");
    const dupRes = await fetch(`${baseUrl}/check-duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Connection: "close" },
      body: JSON.stringify({}),
    });
    assert.equal(dupRes.status, 400);
    const dupBody = await dupRes.json();
    assert.equal(dupBody.error, "clubSlug, eventSlug, and studentEmail are required");
    console.log("✔ Check duplicate validation check passed!");

    // 3. POST /lookup (validation error)
    console.log("\n[Smoke Test 3] POST /lookup (validation error)");
    const lookupRes = await fetch(`${baseUrl}/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Connection: "close" },
      body: JSON.stringify({}),
    });
    assert.equal(lookupRes.status, 400);
    const lookupBody = await lookupRes.json();
    assert.equal(lookupBody.error, "Student email is required");
    console.log("✔ Lookup validation check passed!");

    // 4. POST / (missing club identifier)
    console.log("\n[Smoke Test 4] POST / (missing club identifier)");
    const createRes = await fetch(`${baseUrl}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Connection: "close" },
      body: JSON.stringify({ studentEmail: "test@example.com" }),
    });
    assert.equal(createRes.status, 400);
    const createBody = await createRes.json();
    assert.equal(createBody.error, "Club identifier is required");
    console.log("✔ Create registration validation check passed!");

    // 5. POST /bulk-approve (missing ids, authenticated)
    console.log("\n[Smoke Test 5] POST /bulk-approve (missing ids)");
    const bulkAppRes = await fetch(`${baseUrl}/bulk-approve`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(bulkAppRes.status, 400);
    const bulkAppBody = await bulkAppRes.json();
    assert.equal(bulkAppBody.error, "ids must be a non-empty array");
    console.log("✔ Bulk approve validation check passed!");

    // 6. POST /bulk-reject (missing ids, authenticated)
    console.log("\n[Smoke Test 6] POST /bulk-reject (missing ids)");
    const bulkRejRes = await fetch(`${baseUrl}/bulk-reject`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(bulkRejRes.status, 400);
    const bulkRejBody = await bulkRejRes.json();
    assert.equal(bulkRejBody.error, "ids must be a non-empty array");
    console.log("✔ Bulk reject validation check passed!");

    // 7. GET /stats/member (missing referral code for admin)
    console.log("\n[Smoke Test 7] GET /stats/member (missing code)");
    const memberRes = await fetch(`${baseUrl}/stats/member`, {
      headers: authHeaders,
    });
    assert.equal(memberRes.status, 400);
    const memberBody = await memberRes.json();
    assert.equal(memberBody.error, "Referral code required");
    console.log("✔ Member stats validation check passed!");

    // 8. GET /queue/pending (authenticated unpopulated DB check)
    console.log("\n[Smoke Test 8] GET /queue/pending");
    const queueRes = await fetch(`${baseUrl}/queue/pending`, {
      headers: authHeaders,
    });
    // With dummy clubId and no DB connection, status is 200 (empty array) or 500
    assert.ok([200, 500].includes(queueRes.status));
    console.log(`✔ Pending queue route responded (status ${queueRes.status})`);

    // 9. GET /stats/summary (authenticated unpopulated DB check)
    console.log("\n[Smoke Test 9] GET /stats/summary");
    const summaryRes = await fetch(`${baseUrl}/stats/summary`, {
      headers: authHeaders,
    });
    assert.ok([200, 500].includes(summaryRes.status));
    console.log(`✔ Stats summary route responded (status ${summaryRes.status})`);

    // 10. GET /audit (authenticated unpopulated DB check)
    console.log("\n[Smoke Test 10] GET /audit");
    const auditRes = await fetch(`${baseUrl}/audit`, {
      headers: authHeaders,
    });
    assert.ok([200, 500].includes(auditRes.status));
    console.log(`✔ Audit log route responded (status ${auditRes.status})`);

    console.log("\n=== ALL REGISTRATION ROUTES SMOKE TESTS PASSED ===");
  } finally {
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

runRouteSmokeTests()
  .then(() => {
    setTimeout(() => process.exit(0), 100);
  })
  .catch((err) => {
    console.error("Route Smoke Test Failed:", err);
    process.exit(1);
  });

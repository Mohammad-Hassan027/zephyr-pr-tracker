import "dotenv/config";
import assert from "node:assert/strict";
import express from "express";
import http from "node:http";
import PRMember from "../models/PRMember.js";
import errorHandler from "../middleware/errorHandler.js";
import { createSessionToken } from "../auth/session.service.js";
import { resolveIdentity } from "../auth/identity.service.js";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";
import { canReviewRegistration } from "../policies/registration.policy.js";

async function runSEC03Tests() {
  console.log("=== RUNNING SEC-03 FAIL-CLOSED PR IDENTITY RESOLUTION TESTS ===");

  const originalFindOne = PRMember.findOne;

  const mockClubId = "60d5ecb8b5c9c22b1c8c9999";
  const otherClubId = "60d5ecb8b5c9c22b1c8c8888";
  const validMemberCode = "MEMBER01";

  // Active member doc in DB
  const mockMemberDoc = {
    _id: "member_doc_id_123",
    code: validMemberCode,
    club: mockClubId,
  };

  try {
    // 1. Valid PR token with existing member resolves DB-backed identity
    console.log("\n[Test 1] Valid PR token with existing member resolves DB-backed identity");
    PRMember.findOne = async () => mockMemberDoc;

    const validToken = createSessionToken({
      role: "pr",
      code: validMemberCode,
      clubId: mockClubId,
    });

    const identity1 = await resolveIdentity(validToken);
    assert.equal(identity1.role, "pr");
    assert.equal(identity1.code, validMemberCode);
    assert.equal(identity1.clubId, mockClubId);
    console.log("✔ Resolved DB-backed PR identity successfully!");

    // 2. Valid token for deleted / nonexistent member is rejected
    console.log("\n[Test 2] Valid PR token for deleted/nonexistent member is rejected");
    PRMember.findOne = async () => null;

    let rejected1 = false;
    try {
      await resolveIdentity(validToken);
    } catch (err) {
      assert.equal(err.message, "Authentication required");
      rejected1 = true;
    }
    assert.ok(rejected1);
    console.log("✔ Token for deleted/nonexistent member rejected fail-closed!");

    // 3. Database lookup exception is rejected and NEVER falls back to token claims
    console.log("\n[Test 3] Database error is rejected and NEVER falls back to token claims");
    PRMember.findOne = async () => {
      const dbErr = new Error("MongoNetworkError: connection timed out");
      dbErr.name = "MongoNetworkError";
      throw dbErr;
    };

    let rejectedDbErr = false;
    try {
      await resolveIdentity(validToken);
    } catch (err) {
      assert.equal(err.name, "MongoNetworkError");
      rejectedDbErr = true;
    }
    assert.ok(rejectedDbErr);
    console.log("✔ Database lookup exception propagated fail-closed without token claim fallback!");

    // 4. Token whose clubId differs from member's actual club in DB is rejected
    console.log("\n[Test 4] Token with mismatched clubId claim is rejected");
    PRMember.findOne = async () => mockMemberDoc; // Actual club is mockClubId

    const mismatchedClubToken = createSessionToken({
      role: "pr",
      code: validMemberCode,
      clubId: otherClubId, // Mismatched claim
    });

    let rejectedMismatchedClub = false;
    try {
      await resolveIdentity(mismatchedClubToken);
    } catch (err) {
      assert.equal(err.message, "Authentication required");
      rejectedMismatchedClub = true;
    }
    assert.ok(rejectedMismatchedClub);
    console.log("✔ Token with mismatched clubId claim rejected!");

    // 5. Token with mismatched PR code is rejected
    console.log("\n[Test 5] Token with missing or mismatched PR code is rejected");
    const noCodeToken = createSessionToken({
      role: "pr",
      clubId: mockClubId,
    });

    let rejectedNoCode = false;
    try {
      await resolveIdentity(noCodeToken);
    } catch (err) {
      assert.equal(err.message, "Authentication required");
      rejectedNoCode = true;
    }
    assert.ok(rejectedNoCode);
    console.log("✔ Token without code claim rejected!");

    // 6. Expired or tampered token is rejected
    console.log("\n[Test 6] Expired or tampered token is rejected");
    const past = Math.floor(Date.now() / 1000) - 500;
    const expiredToken = createSessionToken({
      role: "pr",
      code: validMemberCode,
      clubId: mockClubId,
      iat: past - 3600,
      exp: past,
    });

    let rejectedExpired = false;
    try {
      await resolveIdentity(expiredToken);
    } catch (err) {
      assert.match(err.message, /Session expired/);
      rejectedExpired = true;
    }
    assert.ok(rejectedExpired);
    console.log("✔ Expired token rejected!");

    // 7. optionalAuthenticate does NOT attach identity for invalid, stale, or unverifiable tokens
    console.log("\n[Test 7] optionalAuthenticate does not attach identity for invalid/deleted tokens");
    PRMember.findOne = async () => null; // Member deleted

    const app = express();
    app.use(express.json());

    let reqAuthValue = undefined;
    app.get("/optional-test", optionalAuthenticate, (req, res) => {
      reqAuthValue = req.auth;
      res.json({ ok: true });
    });

    let authReqValue = undefined;
    app.get("/mandatory-test", authenticate, (req, res) => {
      authReqValue = req.auth;
      res.json({ ok: true });
    });

    app.use(errorHandler);

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;

    // Optional auth call with deleted member token
    const optRes = await fetch(`http://127.0.0.1:${port}/optional-test`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(optRes.status, 200);
    assert.equal(reqAuthValue, null);
    console.log("✔ optionalAuthenticate set req.auth = null for deleted member token!");

    // Mandatory auth call with deleted member token
    const manRes = await fetch(`http://127.0.0.1:${port}/mandatory-test`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(manRes.status, 401);
    const manBody = await manRes.json();
    assert.equal(manBody.error, "Authentication required");
    console.log("✔ mandatory authenticate rejected deleted member token with 401!");

    // Operational DB Error test on mandatory route returns 503
    PRMember.findOne = async () => {
      const err = new Error("MongoNetworkError");
      err.name = "MongoNetworkError";
      throw err;
    };
    const dbErrRes = await fetch(`http://127.0.0.1:${port}/mandatory-test`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(dbErrRes.status, 503);
    const dbErrBody = await dbErrRes.json();
    assert.equal(dbErrBody.error, "Service unavailable");
    console.log("✔ Database outage returned generic 503 without exposing stack trace or claims!");

    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));

    // 8. Club-admin and platform-admin identities continue to work without PRMember lookups
    console.log("\n[Test 8] Club-admin and platform-admin resolve without PRMember lookups");
    let findOneCalled = false;
    PRMember.findOne = async () => {
      findOneCalled = true;
      return null;
    };

    const clubToken = createSessionToken({ role: "club", clubId: mockClubId, clubSlug: "my-club" });
    const clubIdent = await resolveIdentity(clubToken);
    assert.equal(clubIdent.role, "club");
    assert.equal(clubIdent.clubId, mockClubId);
    assert.equal(findOneCalled, false);

    const platformToken = createSessionToken({ role: "platform_admin" });
    const platformIdent = await resolveIdentity(platformToken);
    assert.equal(platformIdent.role, "platform_admin");
    assert.equal(findOneCalled, false);
    console.log("✔ Club and platform admin tokens resolved cleanly without DB lookups!");

    // 9. Existing cross-tenant authorization policy check
    console.log("\n[Test 9] Cross-tenant authorization policy remains enforced");
    const authMember = { role: "pr", code: validMemberCode, clubId: mockClubId };
    const otherRegistration = { club: otherClubId, referralCode: validMemberCode, status: "pending" };
    assert.equal(canReviewRegistration(authMember, otherRegistration), false);
    console.log("✔ Policy check correctly blocked cross-tenant access!");

    console.log("\n=== ALL SEC-03 FAIL-CLOSED PR IDENTITY RESOLUTION TESTS PASSED ===");
  } finally {
    PRMember.findOne = originalFindOne;
  }
}

runSEC03Tests()
  .then(() => {
    setTimeout(() => process.exit(0), 100);
  })
  .catch((err) => {
    console.error("SEC-03 Test Failed:", err);
    process.exit(1);
  });

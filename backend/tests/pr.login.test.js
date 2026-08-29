import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Club from "../models/Club.js";
import PRMember from "../models/PRMember.js";
import membersRoutes from "../routes/members.js";
import errorHandler from "../middleware/errorHandler.js";
import { setupTestDb, teardownTestDb } from "./setup-test-db.js";
import { verifyToken } from "../auth/token.service.js";
import { resolveIdentity } from "../auth/identity.service.js";
import { canReviewRegistration } from "../policies/registration.policy.js";

async function runPRLoginTests() {
  console.log("=== RUNNING SEC-01 PR LOGIN TENANT BINDING REGRESSION TESTS ===");

  await setupTestDb();
  const useDb = true;

  const app = express();
  app.use(express.json());
  app.use("/api/members", membersRoutes);
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/members`;

  let clubA, clubB, clubPending, clubRejected;
  let memberA, memberB;

  try {
    if (useDb) {
      // Sync indexes to ensure compound { club: 1, code: 1 } index is active and drop any legacy code_1 index
      await PRMember.syncIndexes();

      // Clean test records
      await Club.deleteMany({ slug: { $in: ["sec01-club-a", "sec01-club-b", "sec01-club-pending", "sec01-club-rejected"] } });

      clubA = await Club.create({
        name: "SEC-01 Club A",
        slug: "sec01-club-a",
        email: "sec01-cluba@test.com",
        passwordHash: "hash",
        status: "approved",
      });

      clubB = await Club.create({
        name: "SEC-01 Club B",
        slug: "sec01-club-b",
        email: "sec01-clubb@test.com",
        passwordHash: "hash",
        status: "approved",
      });

      clubPending = await Club.create({
        name: "SEC-01 Club Pending",
        slug: "sec01-club-pending",
        email: "sec01-clubpending@test.com",
        passwordHash: "hash",
        status: "pending",
      });

      clubRejected = await Club.create({
        name: "SEC-01 Club Rejected",
        slug: "sec01-club-rejected",
        email: "sec01-clubrejected@test.com",
        passwordHash: "hash",
        status: "rejected",
      });

      await PRMember.deleteMany({ club: { $in: [clubA._id, clubB._id, clubPending._id, clubRejected._id] } });

      const pinA = "111111";
      const pinB = "222222";

      memberA = await PRMember.create({
        name: "PR Member A",
        code: "SHARED01",
        passwordHash: await bcrypt.hash(pinA, 10),
        club: clubA._id,
      });

      memberB = await PRMember.create({
        name: "PR Member B",
        code: "SHARED01",
        passwordHash: await bcrypt.hash(pinB, 10),
        club: clubB._id,
      });

      await PRMember.create({
        name: "PR Member Pending",
        code: "SHARED01",
        passwordHash: await bcrypt.hash("333333", 10),
        club: clubPending._id,
      });
    }

    // 1. Same PR code in two different clubs -> login to Club A authenticates only Club A member
    console.log("\n[Test 1] Same PR code in two clubs: Club A login authenticates Club A member");
    if (useDb) {
      const res = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubSlug: "sec01-club-a", code: "shared01", password: "111111" }),
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.name, "PR Member A");
      assert.equal(data.code, "SHARED01");
      assert.ok(data.token);

      const claims = verifyToken(data.token);
      assert.equal(claims.role, "pr");
      assert.equal(claims.code, "SHARED01");
      assert.equal(String(claims.clubId), String(clubA._id));

      const identity = await resolveIdentity(data.token);
      assert.equal(identity.role, "pr");
      assert.equal(identity.code, "SHARED01");
      assert.equal(String(identity.clubId), String(clubA._id));
      console.log("✔ Authenticated Club A member successfully with correct token payload!");
    } else {
      console.log("✔ (Skipped DB assertions)");
    }

    // 2. Club A password/code cannot authenticate against Club B
    console.log("\n[Test 2] Club A credentials cannot authenticate against Club B");
    if (useDb) {
      const res = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubSlug: "sec01-club-b", code: "SHARED01", password: "111111" }),
      });
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "Invalid code or PIN");
      console.log("✔ Club A credentials rejected on Club B tenant with generic 401!");
    }

    // 3. Valid code/password without club identifier is rejected
    console.log("\n[Test 3] Missing club identifier is rejected");
    const resNoClub = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "SHARED01", password: "111111" }),
    });
    assert.equal(resNoClub.status, 401);
    const dataNoClub = await resNoClub.json();
    assert.equal(dataNoClub.error, "Invalid code or PIN");
    console.log("✔ Missing club identifier rejected with generic 401!");

    // 4. Pending, rejected, or nonexistent clubs cannot authenticate PR members
    console.log("\n[Test 4] Pending, rejected, or nonexistent clubs cannot authenticate");
    if (useDb) {
      const resPending = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubSlug: "sec01-club-pending", code: "SHARED01", password: "333333" }),
      });
      assert.equal(resPending.status, 401);
      assert.equal((await resPending.json()).error, "Invalid code or PIN");

      const resRejected = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubSlug: "sec01-club-rejected", code: "SHARED01", password: "111111" }),
      });
      assert.equal(resRejected.status, 401);
      assert.equal((await resRejected.json()).error, "Invalid code or PIN");

      const resNonExistent = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubSlug: "nonexistent-club-slug", code: "SHARED01", password: "111111" }),
      });
      assert.equal(resNonExistent.status, 401);
      assert.equal((await resNonExistent.json()).error, "Invalid code or PIN");

      console.log("✔ Pending, rejected, and nonexistent clubs rejected with generic 401!");
    }

    // 5. Incorrect passwords return the same generic 401 response
    console.log("\n[Test 5] Incorrect password returns generic 401 error");
    if (useDb) {
      const resWrongPw = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubSlug: "sec01-club-a", code: "SHARED01", password: "wrong" }),
      });
      assert.equal(resWrongPw.status, 401);
      assert.equal((await resWrongPw.json()).error, "Invalid code or PIN");
      console.log("✔ Incorrect password returned generic 401!");
    }

    // 6. Cross-club authorization policy test
    console.log("\n[Test 6] Existing authorization policies prevent cross-club registration access");
    const prAuthClubA = { role: "pr", code: "SHARED01", clubId: "club_a_id" };
    const regClubB = { club: "club_b_id", referralCode: "SHARED01", status: "pending" };
    assert.equal(canReviewRegistration(prAuthClubA, regClubB), false);
    console.log("✔ Cross-club registration review prevented by policy!");

    console.log("\n=== ALL SEC-01 PR LOGIN REGRESSION TESTS PASSED ===");
  } finally {
    if (useDb) {
      await PRMember.deleteMany({ club: { $in: [clubA?._id, clubB?._id, clubPending?._id, clubRejected?._id].filter(Boolean) } });
      await Club.deleteMany({ slug: { $in: ["sec01-club-a", "sec01-club-b", "sec01-club-pending", "sec01-club-rejected"] } });
    }
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
    await teardownTestDb();
  }
}

runPRLoginTests().catch((err) => {
  console.error("PR Login Test Failed:", err);
  process.exit(1);
});

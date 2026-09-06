import "dotenv/config";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";
import { createSessionToken } from "../utils/auth.js";
import registrationRoutes from "../routes/registrations.js";
import errorHandler from "../middleware/errorHandler.js";
import { setupTestDb, teardownTestDb } from "./setup-test-db.js";
import Club from "../models/Club.js";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import Registration from "../models/Registration.js";

async function runExportRouteTests() {
  console.log("=== RUNNING EXPORT ROUTE & SECURITY INTEGRATION TESTS ===");

  await setupTestDb();

  const uid = Date.now() + Math.floor(Math.random() * 1000);

  // Create Test Fixtures with unique identifiers
  const clubA = await Club.create({
    name: "Club Alpha",
    slug: `club-alpha-${uid}`,
    email: `alpha-${uid}@example.com`,
    passwordHash: "$2a$10$hashedpw",
    status: "approved",
  });

  const clubB = await Club.create({
    name: "Club Beta",
    slug: `club-beta-${uid}`,
    email: `beta-${uid}@example.com`,
    passwordHash: "$2a$10$hashedpw",
    status: "approved",
  });

  const eventA1 = await Event.create({
    name: "Hackathon 2026",
    slug: `hackathon-${uid}`,
    fee: 300,
    venue: "Main Auditorium",
    date: new Date("2026-10-15"),
    club: clubA._id,
  });

  const eventB1 = await Event.create({
    name: "Beta Robotics",
    slug: `beta-robotics-${uid}`,
    fee: 500,
    venue: "Lab 3",
    date: new Date("2026-11-20"),
    club: clubB._id,
  });

  const prMemberA = await PRMember.create({
    name: "Rahul Verma",
    code: `RAHUL${uid % 1000}`,
    passwordHash: "$2a$10$hashedpw",
    club: clubA._id,
  });

  const prCodeA = prMemberA.code;

  // Registrations in Club A
  const regA_approved = await Registration.create({
    studentName: "Aarav Sharma",
    studentEmail: `aarav-${uid}@example.com`,
    studentPhone: "9876543210",
    college: "Engineering College",
    amount: 300,
    utr: `UTR${uid}A`,
    regNo: `REG-${uid}1`,
    event: eventA1._id,
    club: clubA._id,
    referralCode: prCodeA,
    paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/p1.jpg",
    status: "approved",
    reviewedBy: prCodeA,
    attendanceStatus: "present",
    checkedInAt: new Date("2026-10-15T09:30:00.000Z"),
    customFields: { tshirt: "L", track: "AI/ML" },
  });

  const regA_injection = await Registration.create({
    studentName: "=cmd|' /C calc'!A0",
    studentEmail: `inj-${uid}@example.com`,
    studentPhone: "9876543211",
    college: "@DangerousCollege",
    amount: 300,
    utr: "-5+2",
    regNo: `REG-${uid}2`,
    event: eventA1._id,
    club: clubA._id,
    referralCode: prCodeA,
    paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/p2.jpg",
    status: "pending",
  });

  const regA_rejected = await Registration.create({
    studentName: "Sneha Patel",
    studentEmail: `sneha-${uid}@example.com`,
    studentPhone: "9876543212",
    college: "Science Institute",
    amount: 300,
    utr: `UTR${uid}B`,
    event: eventA1._id,
    club: clubA._id,
    referralCode: `OTHER${uid % 1000}`,
    paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/p3.jpg",
    status: "rejected",
    reviewedBy: "admin",
    rejectionReason: "Blurry screenshot",
  });

  // Registration in Club B (Must never leak to Club A)
  const regB_secret = await Registration.create({
    studentName: "Secret Beta Participant",
    studentEmail: `beta-${uid}@example.com`,
    studentPhone: "9999999999",
    amount: 500,
    regNo: `REG-${uid}B`,
    event: eventB1._id,
    club: clubB._id,
    paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/pb.jpg",
    status: "approved",
  });

  // Auth tokens
  const clubAToken = createSessionToken({
    role: "club",
    clubId: String(clubA._id),
    clubSlug: clubA.slug,
  });

  const clubBToken = createSessionToken({
    role: "club",
    clubId: String(clubB._id),
    clubSlug: clubB.slug,
  });

  const prMemberAToken = createSessionToken({
    role: "pr",
    clubId: String(clubA._id),
    code: prMemberA.code,
  });

  const app = express();
  app.use(express.json());
  app.use("/api/registrations", registrationRoutes);
  app.use(errorHandler);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/registrations/export`;

  try {
    // 1. Authorization: Unauthenticated requests return 401
    console.log("\n[Test 1] Unauthenticated request returns 401:");
    const unauthRes = await fetch(baseUrl);
    assert.equal(unauthRes.status, 401);
    console.log("✔ Unauthenticated request rejected with 401!");

    // 2. Multi-tenant Isolation: Club A cannot access Club B data
    console.log("\n[Test 2] Multi-tenant data isolation:");
    const clubAExportRes = await fetch(`${baseUrl}?type=all`, {
      headers: { Authorization: `Bearer ${clubAToken}` },
    });
    assert.equal(clubAExportRes.status, 200);
    assert.equal(clubAExportRes.headers.get("content-type"), "text/csv; charset=utf-8");
    const clubACsv = await clubAExportRes.text();

    assert.ok(clubACsv.includes("Aarav Sharma"), "Club A export must include Club A records");
    assert.ok(clubACsv.includes("Sneha Patel"), "Club A export must include Club A records");
    assert.ok(!clubACsv.includes("Secret Beta Participant"), "CRITICAL: Club A export MUST NOT contain Club B records");
    assert.ok(!clubACsv.includes(`beta-${uid}@example.com`), "CRITICAL: Club A export MUST NOT contain Club B records");
    console.log("✔ Multi-tenant isolation verified: zero cross-club leakage!");

    // 3. Multi-tenant Tampering: Club A admin passing query parameter club=clubB
    console.log("\n[Test 3] Tampering prevention for query param club:");
    const tamperRes = await fetch(`${baseUrl}?club=${clubB._id}`, {
      headers: { Authorization: `Bearer ${clubAToken}` },
    });
    assert.equal(tamperRes.status, 403, "Club A admin trying to pass Club B id must be rejected with 403");
    console.log("✔ Tenant tampering blocked with 403!");

    // 4. Role-based scoping: PR Member only sees their own referrals
    console.log("\n[Test 4] PR member role scoping:");
    const prExportRes = await fetch(`${baseUrl}?type=all`, {
      headers: { Authorization: `Bearer ${prMemberAToken}` },
    });
    assert.equal(prExportRes.status, 200);
    const prCsv = await prExportRes.text();

    assert.ok(prCsv.includes("Aarav Sharma"), "PR member Rahul must see referral Aarav");
    assert.ok(!prCsv.includes("Sneha Patel"), "PR member Rahul MUST NOT see referral assigned to OTHER code");
    console.log("✔ PR member referral scoping verified!");

    // 5. CSV Formula Injection Defense in streamed output
    console.log("\n[Test 5] CSV formula injection defense in output stream:");
    assert.ok(clubACsv.includes(`"'=cmd|' /C calc'!A0"`), "Dangerous = formula must be escaped with single quote");
    assert.ok(clubACsv.includes(`"'@DangerousCollege"`), "Dangerous @ prefix must be escaped with single quote");
    assert.ok(clubACsv.includes(`"'-5+2"`), "Dangerous - prefix must be escaped with single quote");
    console.log("✔ Formula injection defense verified in actual CSV export stream!");

    // 6. Custom Fields in output stream
    console.log("\n[Test 6] Custom registration fields serialization:");
    assert.ok(clubACsv.includes("AI/ML"), "Custom field track should appear in exported row");
    assert.ok(clubACsv.includes("tshirt"), "Custom field tshirt should appear in exported row");
    console.log("✔ Custom fields correctly serialized in CSV!");

    // 7. Export Types: attendance
    console.log("\n[Test 7] Attendance export type:");
    const attRes = await fetch(`${baseUrl}?type=attendance`, {
      headers: { Authorization: `Bearer ${clubAToken}` },
    });
    assert.equal(attRes.status, 200);
    const attCsv = await attRes.text();
    assert.ok(attCsv.includes("Attendance Status"), "Header must include Attendance Status");
    assert.ok(attCsv.includes("present"), "Must include present status");
    console.log("✔ Attendance export type verified!");

    // 8. Export Types: referral_performance
    console.log("\n[Test 8] PR Referral performance export type:");
    const perfRes = await fetch(`${baseUrl}?type=referral_performance`, {
      headers: { Authorization: `Bearer ${clubAToken}` },
    });
    assert.equal(perfRes.status, 200);
    const perfCsv = await perfRes.text();
    assert.ok(perfCsv.includes(prCodeA), "Must include PR member code");
    assert.ok(perfCsv.includes("Rahul Verma"), "Must include PR member name");
    console.log("✔ Referral performance export verified!");

    // 9. Export Types: payment_reconciliation
    console.log("\n[Test 9] Payment reconciliation export type:");
    const payRes = await fetch(`${baseUrl}?type=payment_reconciliation`, {
      headers: { Authorization: `Bearer ${clubAToken}` },
    });
    assert.equal(payRes.status, 200);
    const payCsv = await payRes.text();
    assert.ok(payCsv.includes("UTR / Transaction Reference"), "Header must include UTR column");
    assert.ok(payCsv.includes(`UTR${uid}A`), "Must include UTR number");
    console.log("✔ Payment reconciliation export verified!");

    // 10. Filter by event
    console.log("\n[Test 10] Filtering by event slug:");
    const eventRes = await fetch(`${baseUrl}?event=${eventA1.slug}`, {
      headers: { Authorization: `Bearer ${clubAToken}` },
    });
    assert.equal(eventRes.status, 200);
    const eventCsv = await eventRes.text();
    assert.ok(eventCsv.includes("Hackathon 2026"), "Must contain event records");
    console.log("✔ Event filter verified!");

    console.log("\n=== ALL EXPORT ROUTE INTEGRATION TESTS PASSED ===");
  } finally {
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
    await teardownTestDb();
  }
}

runExportRouteTests().catch((err) => {
  console.error("Export Route Test Failed:", err);
  process.exit(1);
});

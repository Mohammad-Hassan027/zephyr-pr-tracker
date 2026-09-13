import "dotenv/config";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { setupTestDb, teardownTestDb } from "./setup-test-db.js";
import Club from "../models/Club.js";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import PRMember from "../models/PRMember.js";
import registrationService from "../services/registrations/registration.service.js";
import registrationReviewService from "../services/registrations/registration-review.service.js";

async function runDuplicateDetectionIntegrationTests() {
  console.log("=== RUNNING DUPLICATE & SUSPICION DETECTION INTEGRATION TESTS ===\n");

  const cloudinaryEnv = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  await setupTestDb();

  try {
    const fx = Math.random().toString(36).slice(2, 7);

    // ── Fixture Setup ──────────────────────────────────────────────────────────
    const club = await Club.create({
      name: `Dup Club ${fx}`,
      slug: `dup-club-${fx}`,
      email: `dup-${fx}@club.com`,
      passwordHash: "hash123",
      approvedAt: new Date(),
    });

    const eventA = await Event.create({
      name: `Event Alpha ${fx}`,
      slug: `event-alpha-${fx}`,
      club: club._id,
      fee: 100,
      capacity: 50,
      approvedCount: 0,
    });

    const eventB = await Event.create({
      name: `Event Beta ${fx}`,
      slug: `event-beta-${fx}`,
      club: club._id,
      fee: 150,
      capacity: 50,
      approvedCount: 0,
    });

    const prMember = await PRMember.create({
      name: `PR Dan ${fx}`,
      code: `DAN${fx.toUpperCase()}`,
      club: club._id,
      passwordHash: "hash",
    });

    const clubAuth = { role: "club", clubId: club._id.toString() };

    // ── Test 1: Non-blocking ingestion & detection on duplicate email/phone ────
    console.log("[Test 1] Non-blocking duplicate submission ingestion & flag assignment:");
    {
      const initial = await registrationService.createRegistration({
        studentName: "Alice Walker",
        studentEmail: "alice@example.com",
        studentPhone: "9876543210",
        college: "Engineering College",
        amount: 100,
        utr: `UTR_INIT_${fx}`,
        eventSlug: eventA.slug,
        clubSlug: club.slug,
        referralCode: prMember.code,
        paymentScreenshot: `https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/ss_1_${fx}.jpg`,
        paymentScreenshotPublicId: `zephyr-payments/ss_1_${fx}`,
      });

      assert.ok(initial.id, "Initial registration should be created");
      assert.equal(initial.status, "pending");

      // Submit second registration with case/formatting variation (same event)
      const duplicate = await registrationService.createRegistration({
        studentName: "Alice Walker",
        studentEmail: "  ALICE@example.COM  ",
        studentPhone: "+91 98765-43210",
        college: "Engineering College",
        amount: 100,
        utr: `UTR_ALT_${fx}`,
        eventSlug: eventA.slug,
        clubSlug: club.slug,
        referralCode: prMember.code,
        paymentScreenshot: `https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/ss_2_${fx}.jpg`,
        paymentScreenshotPublicId: `zephyr-payments/ss_2_${fx}`,
      });

      assert.ok(duplicate.id, "Duplicate submission must not be blocked at ingestion");
      assert.equal(duplicate.status, "pending");

      const dupDoc = await Registration.findById(duplicate.id).lean();
      assert.equal(dupDoc.suspicionFlags?.isSuspicious, true, "Registration must be flagged as suspicious");
      assert.ok(dupDoc.suspicionFlags.signals.length >= 2, "Must contain email and phone signals");

      const emailSignal = dupDoc.suspicionFlags.signals.find((s) => s.signal === "SAME_EMAIL_SAME_EVENT");
      const phoneSignal = dupDoc.suspicionFlags.signals.find((s) => s.signal === "SAME_PHONE_SAME_EVENT");
      assert.ok(emailSignal, "Must detect SAME_EMAIL_SAME_EVENT");
      assert.ok(phoneSignal, "Must detect SAME_PHONE_SAME_EVENT");

      console.log("  ✔ Duplicate submission accepted without 409 and properly flagged!");
    }

    // ── Test 2: Event-scoped isolation (same user registers for different event) ──
    console.log("\n[Test 2] Event-scoped isolation (same participant across different events):");
    {
      const crossEventReg = await registrationService.createRegistration({
        studentName: "Alice Walker",
        studentEmail: "alice@example.com",
        studentPhone: "9876543210",
        college: "Engineering College",
        amount: 150,
        utr: `UTR_EVENT_B_${fx}`,
        eventSlug: eventB.slug,
        clubSlug: club.slug,
        referralCode: prMember.code,
        paymentScreenshot: `https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/ss_3_${fx}.jpg`,
        paymentScreenshotPublicId: `zephyr-payments/ss_3_${fx}`,
      });

      assert.ok(crossEventReg.id);
      const crossDoc = await Registration.findById(crossEventReg.id).lean();
      const sameEventEmailSignal = crossDoc.suspicionFlags?.signals?.find((s) => s.signal === "SAME_EMAIL_SAME_EVENT");
      assert.equal(sameEventEmailSignal, undefined, "Different event registration must not trigger SAME_EMAIL_SAME_EVENT");

      console.log("  ✔ Cross-event registration allowed without false-positive duplicate flags!");
    }

    // ── Test 3: Reused Transaction ID (UTR) detection ──────────────────────────
    console.log("\n[Test 3] Reused transaction ID (UTR) detection:");
    const sharedUtr = `SHARED_UTR_${fx}`;
    let regWithUtr1;
    let regWithUtr2;
    {
      regWithUtr1 = await registrationService.createRegistration({
        studentName: "Bob Smith",
        studentEmail: `bob_${fx}@example.com`,
        studentPhone: "9111222333",
        college: "Tech Inst",
        amount: 100,
        utr: `  ${sharedUtr.toLowerCase()}  `,
        eventSlug: eventA.slug,
        clubSlug: club.slug,
        paymentScreenshot: `https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/ss_4_${fx}.jpg`,
        paymentScreenshotPublicId: `zephyr-payments/ss_4_${fx}`,
      });

      regWithUtr2 = await registrationService.createRegistration({
        studentName: "Charlie Brown",
        studentEmail: `charlie_${fx}@example.com`,
        studentPhone: "9444555666",
        college: "Arts College",
        amount: 100,
        utr: sharedUtr,
        eventSlug: eventA.slug,
        clubSlug: club.slug,
        paymentScreenshot: `https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/ss_5_${fx}.jpg`,
        paymentScreenshotPublicId: `zephyr-payments/ss_5_${fx}`,
      });

      const doc2 = await Registration.findById(regWithUtr2.id).lean();
      const utrSignal = doc2.suspicionFlags?.signals?.find((s) => s.signal === "REUSED_TRANSACTION_ID");
      assert.ok(utrSignal, "Should detect REUSED_TRANSACTION_ID signal");

      console.log("  ✔ Reused transaction ID detected on submission!");
    }

    // ── Test 4: Prevent duplicate transaction ID from being approved twice ──────
    console.log("\n[Test 4] Atomic approval defense for duplicate transaction IDs:");
    {
      // 1. Approve first registration with the shared UTR -> should succeed
      const approveRes1 = await registrationReviewService.approveRegistration({
        id: regWithUtr1.id,
        auth: clubAuth,
      });
      assert.equal(approveRes1.ok, true);
      assert.equal(approveRes1.data.status, "approved");

      // 2. Attempt to approve second registration with the same shared UTR -> must throw 409
      let errorThrown = null;
      try {
        await registrationReviewService.approveRegistration({
          id: regWithUtr2.id,
          auth: clubAuth,
        });
      } catch (err) {
        errorThrown = err;
      }

      assert.ok(errorThrown, "Must reject approving a duplicate UTR");
      assert.equal(errorThrown.statusCode, 409);
      assert.equal(errorThrown.details?.code || errorThrown.code, "DUPLICATE_TRANSACTION_APPROVED");

      const doc2After = await Registration.findById(regWithUtr2.id).lean();
      assert.equal(doc2After.status, "pending", "Second registration must remain pending and unapproved");

      console.log("  ✔ Second approval blocked with 409 DUPLICATE_TRANSACTION_APPROVED!");
    }

    // ── Test 5: Bulk approval duplicate UTR defense ────────────────────────────
    console.log("\n[Test 5] Bulk approval duplicate UTR defense within same batch:");
    {
      const bulkSharedUtr = `BULK_UTR_${fx}`;
      const b1 = await registrationService.createRegistration({
        studentName: `Student 1 ${fx}`,
        studentEmail: `s1_${fx}@example.com`,
        studentPhone: "9000000001",
        amount: 100,
        utr: bulkSharedUtr,
        eventSlug: eventB.slug,
        clubSlug: club.slug,
        paymentScreenshot: `https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/ss_b1_${fx}.jpg`,
        paymentScreenshotPublicId: `zephyr-payments/ss_b1_${fx}`,
      });

      const b2 = await registrationService.createRegistration({
        studentName: `Student 2 ${fx}`,
        studentEmail: `s2_${fx}@example.com`,
        studentPhone: "9000000002",
        amount: 100,
        utr: bulkSharedUtr,
        eventSlug: eventB.slug,
        clubSlug: club.slug,
        paymentScreenshot: `https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/ss_b2_${fx}.jpg`,
        paymentScreenshotPublicId: `zephyr-payments/ss_b2_${fx}`,
      });

      const bulkRes = await registrationReviewService.bulkApproveRegistrations({
        ids: [b1.id, b2.id],
        auth: clubAuth,
      });

      assert.equal(bulkRes.processed, 1, "Exactly 1 item should be approved");
      assert.equal(bulkRes.failed, 1, "The duplicate UTR should fail in bulk approval");
      assert.equal(bulkRes.errors[0].code, "DUPLICATE_TRANSACTION_APPROVED");

      console.log("  ✔ Bulk approval processed the first and rejected duplicate in batch!");
    }

    // ── Test 6: Reviewer resolution workflows ─────────────────────────────────
    console.log("\n[Test 6] Reviewer duplicate resolution actions:");
    {
      // A. Mark Legitimate
      const resolveLegit = await registrationReviewService.resolveDuplicateFlag({
        id: regWithUtr2.id,
        action: "mark_legitimate",
        notes: "Verified with bank statement that payment was distinct",
        auth: clubAuth,
      });

      assert.equal(resolveLegit.ok, true);
      assert.equal(resolveLegit.data.suspicionFlags.resolution.status, "marked_legitimate");
      assert.equal(resolveLegit.data.suspicionFlags.isSuspicious, false);

      // B. Confirm Duplicate
      const resolveDup = await registrationReviewService.resolveDuplicateFlag({
        id: regWithUtr2.id,
        action: "confirm_duplicate",
        notes: "Confirmed participant sent duplicate transaction screenshot",
        auth: clubAuth,
      });

      assert.equal(resolveDup.ok, true);
      assert.equal(resolveDup.data.suspicionFlags.resolution.status, "confirmed_duplicate");
      assert.equal(resolveDup.data.suspicionFlags.isSuspicious, true);

      // Verify audit history was appended
      const updatedDoc = await Registration.findById(regWithUtr2.id).lean();
      const auditEntries = updatedDoc.history.filter((h) => h.action === "duplicate_flag_resolved");
      assert.ok(auditEntries.length >= 2, "History must record duplicate resolution decisions");

      console.log("  ✔ Duplicate resolution actions ('mark_legitimate', 'confirm_duplicate') verified with audit history!");
    }

    console.log("\n=================================================================");
    console.log("✅ ALL DUPLICATE & SUSPICION DETECTION INTEGRATION TESTS PASSED\n");
  } finally {
    await teardownTestDb();
    for (const [key, value] of Object.entries(cloudinaryEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

runDuplicateDetectionIntegrationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Duplicate Detection Integration Test Failed:", err);
    process.exit(1);
  });

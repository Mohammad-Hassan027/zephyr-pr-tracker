import "dotenv/config";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Club from "../models/Club.js";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import PRMember from "../models/PRMember.js";
import registrationReviewService from "../services/registrations/registration-review.service.js";
import registrationService from "../services/registrations/registration.service.js";

async function runCorrectionWorkflowTests() {
  console.log("=== RUNNING CORRECTION & RESUBMISSION WORKFLOW TESTS ===");

  const mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  try {
    // Setup test Club, Event, and PR Member
    const club = await Club.create({
      name: "Tech Club",
      slug: "tech-club",
      email: "tech@club.com",
      passwordHash: "hash123",
      approvedAt: new Date(),
    });

    const event = await Event.create({
      name: "Hackathon 2026",
      slug: "hackathon-2026",
      club: club._id,
      date: new Date(),
      venue: "Main Hall",
      fee: 100,
      capacity: 50,
    });

    const prMember = await PRMember.create({
      name: "John PR",
      code: "JOHN123",
      club: club._id,
      passwordHash: "hash",
    });

    const clubAuth = { role: "club", clubId: club._id.toString() };
    const prAuth = { role: "pr", code: prMember.code, clubId: club._id.toString() };
    const wrongClubAuth = { role: "club", clubId: new mongoose.Types.ObjectId().toString() };

    // 1. Create Initial Registration
    console.log("\n[Test 1] Create Initial Registration & History Initialization:");
    const regRes = await registrationService.createRegistration({
      studentName: "Alice Smith",
      studentEmail: "alice@example.com",
      studentPhone: "9876543210",
      college: "ABC Tech",
      amount: 100,
      utr: "UTR10001",
      eventSlug: event.slug,
      clubSlug: club.slug,
      referralCode: prMember.code,
      paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v12345/zephyr-payments/ss_01.jpg",
      paymentScreenshotPublicId: "zephyr-payments/ss_01",
    });

    assert.ok(regRes.id);
    assert.equal(regRes.status, "pending");

    let reg = await Registration.findById(regRes.id);
    assert.equal(reg.history.length, 1);
    assert.equal(reg.history[0].action, "submitted");
    assert.equal(reg.history[0].status, "pending");
    console.log("✔ Registration created with initial history entry!");

    // 2. Correction Note Validation
    console.log("\n[Test 2] Correction Note Validation:");
    await assert.rejects(
      async () => {
        await registrationReviewService.requestCorrection({
          id: reg._id.toString(),
          note: "",
          auth: clubAuth,
        });
      },
      (err) => err.statusCode === 400 && err.message.includes("Correction note is required")
    );
    console.log("✔ Empty correction note rejected with 400!");

    // 3. Permission Checks on Correction Request
    console.log("\n[Test 3] Permission Checks:");
    await assert.rejects(
      async () => {
        await registrationReviewService.requestCorrection({
          id: reg._id.toString(),
          note: "Please fix screenshot",
          auth: wrongClubAuth,
        });
      },
      (err) => err.statusCode === 403
    );
    console.log("✔ Unauthorized club blocked from requesting correction!");

    // 4. Request Correction Success
    console.log("\n[Test 4] Successful Correction Request by Reviewer:");
    const corrRes = await registrationReviewService.requestCorrection({
      id: reg._id.toString(),
      note: "UTR number is illegible in screenshot. Please re-upload clearer image.",
      auth: prAuth,
    });

    assert.equal(corrRes.ok, true);
    reg = await Registration.findById(reg._id);
    assert.equal(reg.status, "needs_correction");
    assert.equal(reg.correctionNote, "UTR number is illegible in screenshot. Please re-upload clearer image.");
    assert.equal(reg.reviewedBy, prMember.code);
    assert.equal(reg.history.length, 2);
    assert.equal(reg.history[1].action, "requested_correction");
    assert.equal(reg.history[1].status, "needs_correction");
    console.log("✔ Correction request updated status to 'needs_correction' and logged history!");

    // 5. Duplicate Prevention & Contributor Resubmission
    console.log("\n[Test 5] Contributor Resubmission (In-Place Update & Duplicate Prevention):");
    const countBefore = await Registration.countDocuments({ event: event._id, studentEmail: "alice@example.com" });
    assert.equal(countBefore, 1);

    const resubmitRes = await registrationService.resubmitRegistration(reg._id.toString(), {
      studentPhone: "9998887776",
      utr: "UTR99999",
      paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v12345/zephyr-payments/ss_02.jpg",
      paymentScreenshotPublicId: "zephyr-payments/ss_02",
    });

    assert.equal(resubmitRes.ok, true);
    assert.equal(resubmitRes.data.status, "resubmitted");

    const countAfter = await Registration.countDocuments({ event: event._id, studentEmail: "alice@example.com" });
    assert.equal(countAfter, 1); // Exact same record modified, no duplicates created!

    reg = await Registration.findById(reg._id);
    assert.equal(reg.status, "resubmitted");
    assert.equal(reg.utr, "UTR99999");
    assert.equal(reg.studentPhone, "9998887776");
    assert.equal(reg.paymentScreenshotPublicId, "zephyr-payments/ss_02");
    assert.equal(reg.history.length, 3);
    assert.equal(reg.history[2].action, "resubmitted");
    assert.equal(reg.history[2].status, "resubmitted");
    assert.ok(reg.history[2].changes.utr);
    console.log("✔ Contributor resubmitted successfully in-place without creating duplicate records!");

    // 6. Block Resubmission when NOT in 'needs_correction'
    console.log("\n[Test 6] Block Resubmission when Not in 'needs_correction' State:");
    await assert.rejects(
      async () => {
        await registrationService.resubmitRegistration(reg._id.toString(), {
          utr: "UTR123",
        });
      },
      (err) => err.statusCode === 400 && err.message.includes("Resubmission is only allowed when status is 'needs_correction'")
    );
    console.log("✔ Duplicate or invalid resubmission blocked when status is 'resubmitted'!");

    // 7. Final Reviewer Approval after Resubmission
    console.log("\n[Test 7] Reviewer Approval of Resubmitted Registration:");
    const approveRes = await registrationReviewService.approveRegistration({
      id: reg._id.toString(),
      auth: clubAuth,
    });

    assert.equal(approveRes.ok, true);
    reg = await Registration.findById(reg._id);
    assert.equal(reg.status, "approved");
    assert.ok(reg.regNo.startsWith("REG-"));
    assert.equal(reg.history.length, 4);
    assert.equal(reg.history[3].action, "approved");
    assert.equal(reg.history[3].status, "approved");
    console.log("✔ Resubmitted registration approved with sequential regNo!");

    // 8. Cannot request correction on approved registration
    console.log("\n[Test 8] Cannot request correction on approved registration:");
    await assert.rejects(
      async () => {
        await registrationReviewService.requestCorrection({
          id: reg._id.toString(),
          note: "Too late",
          auth: clubAuth,
        });
      },
      (err) => err.statusCode === 409
    );
    console.log("✔ Cannot request correction on approved registration!");

    console.log("\n=== ALL CORRECTION & RESUBMISSION WORKFLOW TESTS PASSED ===");
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runCorrectionWorkflowTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Correction Workflow Test Failed:", err);
    process.exit(1);
  });

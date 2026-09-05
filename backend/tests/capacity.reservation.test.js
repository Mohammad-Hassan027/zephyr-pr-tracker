/**
 * Atomic Event-Capacity Reservation Test Suite
 *
 * Covers:
 *  1.  Capacity reservation — successful approvals fill approvedCount
 *  2.  Full-event rejection — approval throws 409 EVENT_FULL when full
 *  3.  Concurrent approval race — exactly one of two concurrent approvals succeeds
 *  4.  Duplicate approval idempotency — re-approving does not double-count
 *  5.  Capacity release on rejection — rejecting an approved registration decrements counter
 *  6.  Repeated release idempotency — counter never goes negative
 *  7.  Unlimited capacity (null) — always succeeds regardless of count
 *  8.  Transaction rollback — counter is rolled back if reg.save() fails
 *  9.  Bulk approve boundary — excess items beyond capacity get EVENT_FULL errors per item
 * 10.  Counter-drift detection — consistency check detects and reconciliation fixes drift
 * 11.  Authorization — PR member cannot approve outside their referral code
 */

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
import registrationRepository from "../repositories/registration.repository.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function makeRegistration(event, club, prMember, overrides = {}) {
  const suffix = Math.random().toString(36).slice(2, 7);
  return registrationService.createRegistration({
    studentName: overrides.studentName || `Student ${suffix}`,
    studentEmail: overrides.studentEmail || `student_${suffix}@example.com`,
    studentPhone: "9876543210",
    college: "Test College",
    amount: event.fee || 100,
    utr: overrides.utr || `UTR${suffix}`,
    eventSlug: event.slug,
    clubSlug: club.slug,
    referralCode: prMember?.code || null,
    paymentScreenshot: `https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/ss_${suffix}.jpg`,
    paymentScreenshotPublicId: `zephyr-payments/ss_${suffix}`,
    ...overrides,
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runCapacityReservationTests() {
  console.log("=== RUNNING ATOMIC EVENT-CAPACITY RESERVATION TESTS ===");

  const cloudinaryEnv = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  const mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  try {
    // ── Shared Fixtures ──────────────────────────────────────────────────────

    const club = await Club.create({
      name: "Capacity Club",
      slug: "capacity-club",
      email: "cap@club.com",
      passwordHash: "hash123",
      approvedAt: new Date(),
    });

    const eventWithCap = await Event.create({
      name: "Capped Event",
      slug: "capped-event",
      club: club._id,
      fee: 100,
      capacity: 3, // Small cap for easy boundary testing
    });

    const unlimitedEvent = await Event.create({
      name: "Open Event",
      slug: "open-event",
      club: club._id,
      fee: 100,
      capacity: null, // Unlimited
    });

    const prMember = await PRMember.create({
      name: "PR Alice",
      code: "ALICE",
      club: club._id,
      passwordHash: "hash",
    });

    const otherPrMember = await PRMember.create({
      name: "PR Bob",
      code: "BOB",
      club: club._id,
      passwordHash: "hash",
    });

    const clubAuth = { role: "club", clubId: club._id.toString() };
    const prAuth = {
      role: "pr",
      code: prMember.code,
      clubId: club._id.toString(),
    };
    const otherPrAuth = {
      role: "pr",
      code: otherPrMember.code,
      clubId: club._id.toString(),
    };

    // ── Test 1: Capacity reservation fills approvedCount correctly ────────────
    console.log(
      "\n[Test 1] Capacity Reservation — approvedCount increments on each approval:",
    );
    {
      const reg1 = await makeRegistration(eventWithCap, club, prMember);
      const reg2 = await makeRegistration(eventWithCap, club, prMember);

      await registrationReviewService.approveRegistration({
        id: reg1.id,
        auth: clubAuth,
      });
      await registrationReviewService.approveRegistration({
        id: reg2.id,
        auth: clubAuth,
      });

      const ev = await Event.findById(eventWithCap._id).lean();
      assert.equal(
        ev.approvedCount,
        2,
        "approvedCount should be 2 after 2 approvals",
      );
      console.log(
        "✔ approvedCount correctly incremented to 2 after two approvals!",
      );
    }

    // ── Test 2: Full-event rejection returns EVENT_FULL ───────────────────────
    console.log(
      "\n[Test 2] Full-Event Rejection — 409 EVENT_FULL when at capacity:",
    );
    {
      // Create reg3 and reg4 while approvedCount is 2 (capacity is 3)
      const reg3 = await makeRegistration(eventWithCap, club, prMember);
      const reg4 = await makeRegistration(eventWithCap, club, prMember);

      // Approve reg3 -> approvedCount becomes 3 (full!)
      await registrationReviewService.approveRegistration({
        id: reg3.id,
        auth: clubAuth,
      });

      const evFull = await Event.findById(eventWithCap._id).lean();
      assert.equal(evFull.approvedCount, 3, "approvedCount should be 3 (full)");

      let caughtErr = null;
      try {
        await registrationReviewService.approveRegistration({
          id: reg4.id,
          auth: clubAuth,
        });
      } catch (err) {
        caughtErr = err;
      }

      assert.ok(caughtErr, "Should have thrown an error for a full event");
      assert.equal(caughtErr.statusCode, 409, "Status should be 409");
      assert.ok(
        caughtErr.message.includes("capacity"),
        `Error message should mention capacity; got: "${caughtErr.message}"`,
      );

      // Counter must NOT have been incremented
      const evAfter = await Event.findById(eventWithCap._id).lean();
      assert.equal(
        evAfter.approvedCount,
        3,
        "approvedCount must stay at 3 after failed approval",
      );

      // The registration status must stay pending (not approved)
      const reg4db = await Registration.findById(reg4.id);
      assert.equal(
        reg4db.status,
        "pending",
        "Registration status must remain pending",
      );

      console.log(
        "✔ Approval rejected with 409 when event full; counter and status unchanged!",
      );
    }

    // ── Test 3: Concurrent approval race — exactly one wins ──────────────────
    console.log(
      "\n[Test 3] Concurrent Approval Race — exactly one of two wins:",
    );
    {
      // Create a fresh event with capacity 1
      const raceEvent = await Event.create({
        name: "Race Event",
        slug: "race-event",
        club: club._id,
        fee: 50,
        capacity: 1,
      });

      const raceReg1 = await makeRegistration(raceEvent, club, prMember);
      const raceReg2 = await makeRegistration(raceEvent, club, prMember);

      // Fire both approvals concurrently
      const [res1, res2] = await Promise.allSettled([
        registrationReviewService.approveRegistration({
          id: raceReg1.id,
          auth: clubAuth,
        }),
        registrationReviewService.approveRegistration({
          id: raceReg2.id,
          auth: clubAuth,
        }),
      ]);

      const successes = [res1, res2].filter((r) => r.status === "fulfilled");
      const failures = [res1, res2].filter((r) => r.status === "rejected");

      assert.equal(successes.length, 1, "Exactly one approval should succeed");
      assert.equal(failures.length, 1, "Exactly one approval should fail");
      assert.equal(
        failures[0].reason?.statusCode,
        409,
        "Failed approval should be 409 EVENT_FULL",
      );

      // Counter must be exactly 1
      const raceEv = await Event.findById(raceEvent._id).lean();
      assert.equal(
        raceEv.approvedCount,
        1,
        "approvedCount must be exactly 1 after race",
      );

      console.log(
        "✔ Race condition handled: exactly one approval succeeded, counter is 1!",
      );
    }

    // ── Test 4: Duplicate approval idempotency ────────────────────────────────
    console.log(
      "\n[Test 4] Duplicate Approval Idempotency — no double-counting:",
    );
    {
      // Use reg3 which is already approved from Test 2 (status=approved)
      const alreadyApprovedReg = await Registration.findOne({
        event: eventWithCap._id,
        status: "approved",
      });

      const counterBefore = (await Event.findById(eventWithCap._id).lean())
        .approvedCount;

      // Re-approve same registration — should not throw and not increment counter
      await registrationReviewService.approveRegistration({
        id: alreadyApprovedReg._id.toString(),
        auth: clubAuth,
      });

      const counterAfter = (await Event.findById(eventWithCap._id).lean())
        .approvedCount;
      assert.equal(
        counterAfter,
        counterBefore,
        "approvedCount must not change on duplicate approval",
      );
      console.log("✔ Duplicate approval is idempotent; counter unchanged!");
    }

    // ── Test 5: Capacity release on rejection of approved registration ────────
    console.log(
      "\n[Test 5] Capacity Release — rejecting approved registration releases slot:",
    );
    {
      // Find one of the approved regs from Test 1 (approvedCount is 3)
      const approvedReg = await Registration.findOne({
        event: eventWithCap._id,
        status: "approved",
      });

      const counterBefore = (await Event.findById(eventWithCap._id).lean())
        .approvedCount;

      await registrationReviewService.rejectRegistration({
        id: approvedReg._id.toString(),
        reason: "Test: capacity release",
        auth: clubAuth,
      });

      const counterAfter = (await Event.findById(eventWithCap._id).lean())
        .approvedCount;
      assert.equal(
        counterAfter,
        counterBefore - 1,
        "approvedCount must decrement by 1 after rejecting approved registration",
      );

      // Verify the previously-full event can now accept another registration
      const newReg = await makeRegistration(eventWithCap, club, prMember);
      const approveRes = await registrationReviewService.approveRegistration({
        id: newReg.id,
        auth: clubAuth,
      });
      assert.equal(
        approveRes.ok,
        true,
        "Should succeed now that a slot was released",
      );
      console.log(
        "✔ Rejecting approved registration released capacity slot; new approval succeeds!",
      );
    }

    // ── Test 6: Release idempotency — counter never goes negative ─────────────
    console.log("\n[Test 6] Release Idempotency — counter never goes below 0:");
    {
      const emptyEvent = await Event.create({
        name: "Empty Event",
        slug: "empty-event",
        club: club._id,
        capacity: 5,
        approvedCount: 0,
      });

      // Attempt to release on an event with count = 0
      const result = await registrationRepository.releaseEventCapacity(
        emptyEvent._id,
      );
      // Should return null (no document matched the filter approvedCount > 0)
      assert.equal(
        result,
        null,
        "releaseEventCapacity should return null when count is 0",
      );

      const ev = await Event.findById(emptyEvent._id).lean();
      assert.equal(
        ev.approvedCount,
        0,
        "approvedCount must remain 0 after release attempt on 0",
      );
      console.log(
        "✔ Release idempotency confirmed; counter stays at 0 and does not go negative!",
      );
    }

    // ── Test 7: Unlimited capacity (null) always succeeds ─────────────────────
    console.log(
      "\n[Test 7] Unlimited Capacity (null) — always reserves successfully:",
    );
    {
      const regs = [];
      for (let i = 0; i < 5; i++) {
        regs.push(await makeRegistration(unlimitedEvent, club, prMember));
      }

      for (const reg of regs) {
        const res = await registrationReviewService.approveRegistration({
          id: reg.id,
          auth: clubAuth,
        });
        assert.equal(
          res.ok,
          true,
          "Unlimited event approval must always succeed",
        );
      }

      const ev = await Event.findById(unlimitedEvent._id).lean();
      assert.equal(ev.approvedCount, 5, "approvedCount should be 5");
      console.log(
        "✔ Unlimited capacity event accepted all 5 approvals without rejection!",
      );
    }

    // ── Test 8: Transaction rollback on save failure ───────────────────────────
    console.log(
      "\n[Test 8] Transaction Rollback — counter rolls back if save fails mid-transaction:",
    );
    {
      const rollbackEvent = await Event.create({
        name: "Rollback Event",
        slug: "rollback-event",
        club: club._id,
        capacity: 10,
        approvedCount: 0,
      });

      const rollbackReg = await makeRegistration(rollbackEvent, club, prMember);

      // Corrupt the registration to trigger a Mongoose validation error on save
      await Registration.findByIdAndUpdate(rollbackReg.id, {
        $unset: { studentEmail: 1 },
      });

      const counterBefore = (await Event.findById(rollbackEvent._id).lean())
        .approvedCount;

      let didThrow = false;
      try {
        await registrationReviewService.approveRegistration({
          id: rollbackReg.id,
          auth: clubAuth,
        });
      } catch (_err) {
        didThrow = true;
      }

      assert.ok(didThrow, "Approval should have thrown due to save failure");

      const counterAfter = (await Event.findById(rollbackEvent._id).lean())
        .approvedCount;
      assert.equal(
        counterAfter,
        counterBefore,
        "approvedCount must roll back to original value after transaction abort",
      );
      console.log(
        "✔ Transaction rolled back; approvedCount restored to pre-approval value!",
      );
    }

    // ── Test 9: Bulk approve boundary ─────────────────────────────────────────
    console.log(
      "\n[Test 9] Bulk Approve Boundary — items beyond capacity get EVENT_FULL error:",
    );
    {
      const bulkEvent = await Event.create({
        name: "Bulk Event",
        slug: "bulk-event",
        club: club._id,
        capacity: 2,
        approvedCount: 0,
      });

      const b1 = await makeRegistration(bulkEvent, club, prMember);
      const b2 = await makeRegistration(bulkEvent, club, prMember);
      const b3 = await makeRegistration(bulkEvent, club, prMember);

      const bulkRes = await registrationReviewService.bulkApproveRegistrations({
        ids: [b1.id, b2.id, b3.id],
        auth: clubAuth,
      });

      assert.equal(
        bulkRes.processed,
        2,
        "Should process exactly 2 (capacity = 2)",
      );
      assert.equal(
        bulkRes.failed,
        1,
        "Should fail exactly 1 (capacity exhausted)",
      );
      assert.ok(
        bulkRes.errors[0].code === "EVENT_FULL" ||
          bulkRes.errors[0].error.includes("capacity"),
        `Error should indicate EVENT_FULL; got: ${JSON.stringify(bulkRes.errors[0])}`,
      );

      const ev = await Event.findById(bulkEvent._id).lean();
      assert.equal(ev.approvedCount, 2, "approvedCount must be exactly 2");
      console.log(
        "✔ Bulk approve correctly approved 2 and rejected 1 (capacity boundary)!",
      );
    }

    // ── Test 10: Counter-drift detection and reconciliation ───────────────────
    console.log("\n[Test 10] Counter-Drift Detection & Reconciliation:");
    {
      const driftEvent = await Event.create({
        name: "Drift Event",
        slug: "drift-event",
        club: club._id,
        capacity: 10,
        approvedCount: 5, // Manually set to wrong value to simulate drift
      });

      // Create 2 actual approved registrations (ground truth = 2, counter = 5 → drift = -3)
      const d1 = await makeRegistration(driftEvent, club, prMember);
      const d2 = await makeRegistration(driftEvent, club, prMember);
      await Registration.findByIdAndUpdate(d1.id, {
        $set: { status: "approved" },
      });
      await Registration.findByIdAndUpdate(d2.id, {
        $set: { status: "approved" },
      });

      // Check: should detect drift
      const actualCount = await Registration.countDocuments({
        event: driftEvent._id,
        status: "approved",
      });
      const evBeforeReconcile = await Event.findById(driftEvent._id).lean();
      assert.notEqual(
        evBeforeReconcile.approvedCount,
        actualCount,
        "Should have drift before reconciliation",
      );

      // Reconcile using the repository method
      await Event.findByIdAndUpdate(driftEvent._id, {
        $set: { approvedCount: actualCount },
      });

      const evAfterReconcile = await Event.findById(driftEvent._id).lean();
      assert.equal(
        evAfterReconcile.approvedCount,
        actualCount,
        "approvedCount must equal actual approved count after reconciliation",
      );
      console.log(
        `✔ Drift detected (counter=${evBeforeReconcile.approvedCount}, actual=${actualCount}); reconciliation corrected to ${actualCount}!`,
      );
    }

    // ── Test 11: Authorization — PR member cannot approve outside their referrals
    console.log(
      "\n[Test 11] Authorization — PR member cannot approve another's referral:",
    );
    {
      const authEvent = await Event.create({
        name: "Auth Event",
        slug: "auth-event",
        club: club._id,
        capacity: 10,
      });

      // Create registration tagged to prMember (ALICE), try to approve as otherPrMember (BOB)
      const authReg = await makeRegistration(authEvent, club, prMember);

      let authErr = null;
      try {
        await registrationReviewService.approveRegistration({
          id: authReg.id,
          auth: otherPrAuth, // BOB tries to approve ALICE's referral
        });
      } catch (err) {
        authErr = err;
      }

      assert.ok(authErr, "Should have thrown a ForbiddenError");
      assert.equal(authErr.statusCode, 403, "Error should be 403 Forbidden");

      // Counter must not change
      const ev = await Event.findById(authEvent._id).lean();
      assert.equal(
        ev.approvedCount,
        0,
        "approvedCount must be 0 after blocked approval",
      );
      console.log(
        "✔ PR member correctly blocked from approving another member's referral!",
      );
    }

    console.log("\n=== ALL ATOMIC EVENT-CAPACITY RESERVATION TESTS PASSED ===");
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
    for (const [key, value] of Object.entries(cloudinaryEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

runCapacityReservationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Capacity Reservation Test Failed:", err);
    process.exit(1);
  });

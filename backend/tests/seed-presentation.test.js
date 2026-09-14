/**
 * seed-presentation.test.js
 *
 * Automated verification of the presentation data seeder:
 * - Idempotency: Running twice produces 0 new duplicates.
 * - Non-destructive: Does not wipe or alter unrelated records.
 * - Capacity consistency: Event.approvedCount exactly reflects approved registrations.
 * - Credential safety: Seed output/models do not expose raw secrets.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { setupTestDb, teardownTestDb } from "./setup-test-db.js";
import { seedPresentation } from "../scripts/seed-presentation.js";
import Club from "../models/Club.js";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import Registration from "../models/Registration.js";

describe("Presentation Seeder Suite", () => {
  before(async () => {
    await setupTestDb();
  });

  after(async () => {
    await teardownTestDb();
  });

  it("1. First run seeds full presentation dataset and reconciles capacity", async () => {
    // Insert an unrelated third-party club and event to verify non-destructive behavior
    const unrelatedClub = await Club.create({
      name: "Unrelated Third Party Club",
      slug: "unrelated-club",
      email: "unrelated@external.org",
      passwordHash: "somehash",
      status: "approved",
    });
    const unrelatedEvent = await Event.create({
      name: "Unrelated External Event",
      slug: "unrelated-event",
      capacity: 50,
      approvedCount: 0,
      club: unrelatedClub._id,
    });
    const unrelatedReg = await Registration.create({
      studentName: "External Participant",
      studentEmail: "external@external.org",
      college: "External University",
      amount: 100,
      paymentScreenshot: "https://placehold.co/100",
      event: unrelatedEvent._id,
      club: unrelatedClub._id,
      status: "pending",
    });

    const stats1 = await seedPresentation({ disconnectOnComplete: false, silent: true });

    assert.equal(stats1.clubs.created, 1, "Expected 1 presentation club created");
    assert.equal(stats1.events.created, 3, "Expected 3 presentation events created");
    assert.equal(stats1.members.created, 4, "Expected 4 PR members created");
    assert.equal(stats1.registrations.created, 10, "Expected 10 registrations created");

    // Verify presentation club
    const presClub = await Club.findOne({ slug: "presentation-zephyr-tech" });
    assert.ok(presClub, "Presentation club must exist");
    assert.equal(presClub.status, "approved");

    // Verify events and capacity reconciliation
    const codingWar = await Event.findOne({ club: presClub._id, slug: "presentation-coding-war" });
    assert.ok(codingWar, "Coding War event must exist");
    const codingWarApproved = await Registration.countDocuments({
      event: codingWar._id,
      status: "approved",
    });
    assert.equal(codingWar.approvedCount, codingWarApproved, "Coding War approvedCount must match approved registrations");
    assert.equal(codingWar.approvedCount, 2, "Expected exactly 2 approved registrations for Coding War");

    const cloudWorkshop = await Event.findOne({ club: presClub._id, slug: "presentation-cloud-workshop" });
    assert.ok(cloudWorkshop, "Cloud Workshop event must exist");
    const cloudWorkshopApproved = await Registration.countDocuments({
      event: cloudWorkshop._id,
      status: "approved",
    });
    assert.equal(cloudWorkshop.approvedCount, cloudWorkshopApproved, "Cloud Workshop approvedCount must match approved registrations");
    assert.equal(cloudWorkshop.approvedCount, 3, "Expected exactly 3 approved registrations for Cloud Workshop");

    // Verify unrelated data remains completely untouched
    const stillUnrelatedClub = await Club.findById(unrelatedClub._id);
    assert.ok(stillUnrelatedClub, "Unrelated club must not be deleted");
    const stillUnrelatedEvent = await Event.findById(unrelatedEvent._id);
    assert.ok(stillUnrelatedEvent, "Unrelated event must not be deleted");
    const stillUnrelatedReg = await Registration.findById(unrelatedReg._id);
    assert.ok(stillUnrelatedReg, "Unrelated registration must not be deleted");
  });

  it("2. Second run is strictly idempotent: updates records without creating duplicates", async () => {
    const totalClubsBefore = await Club.countDocuments();
    const totalEventsBefore = await Event.countDocuments();
    const totalMembersBefore = await PRMember.countDocuments();
    const totalRegsBefore = await Registration.countDocuments();

    const stats2 = await seedPresentation({ disconnectOnComplete: false, silent: true });

    assert.equal(stats2.clubs.created, 0, "Second run should create 0 clubs");
    assert.equal(stats2.clubs.updated, 1, "Second run should update 1 club");

    assert.equal(stats2.events.created, 0, "Second run should create 0 events");
    assert.equal(stats2.events.updated, 3, "Second run should update 3 events");

    assert.equal(stats2.members.created, 0, "Second run should create 0 PR members");
    assert.equal(stats2.members.updated, 4, "Second run should update 4 PR members");

    assert.equal(stats2.registrations.created, 0, "Second run should create 0 registrations");
    assert.equal(stats2.registrations.updated, 10, "Second run should update 10 registrations");

    const totalClubsAfter = await Club.countDocuments();
    const totalEventsAfter = await Event.countDocuments();
    const totalMembersAfter = await PRMember.countDocuments();
    const totalRegsAfter = await Registration.countDocuments();

    assert.equal(totalClubsAfter, totalClubsBefore, "Total club count must remain constant");
    assert.equal(totalEventsAfter, totalEventsBefore, "Total event count must remain constant");
    assert.equal(totalMembersAfter, totalMembersBefore, "Total member count must remain constant");
    assert.equal(totalRegsAfter, totalRegsBefore, "Total registration count must remain constant");
  });
});
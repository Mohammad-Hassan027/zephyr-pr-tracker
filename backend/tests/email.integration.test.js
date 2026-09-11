import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Club from "../models/Club.js";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import PRMember from "../models/PRMember.js";
import { registrationService } from "../services/registrations/registration.service.js";
import { registrationReviewService } from "../services/registrations/registration-review.service.js";
import { emailService } from "../services/email/email.service.js";
import { MockProvider } from "../services/email/providers/mock.provider.js";
import { notificationQueue } from "../services/email/notification-queue.service.js";

test("Email Integration & Workflow Trigger Suite", async (t) => {
  let replSet;
  let mockProvider;

  const cloudinaryEnv = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  const createTestClub = (name, slug) => {
    return Club.create({
      name,
      slug,
      email: `${slug}@zephyr.local`,
      passwordHash: "dummy-password-hash-1234567890",
    });
  };

  t.before(async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    mockProvider = new MockProvider();
    emailService.setProvider(mockProvider);

    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(replSet.getUri());
  });

  t.after(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();

    if (cloudinaryEnv.CLOUDINARY_CLOUD_NAME) process.env.CLOUDINARY_CLOUD_NAME = cloudinaryEnv.CLOUDINARY_CLOUD_NAME;
    if (cloudinaryEnv.CLOUDINARY_API_KEY) process.env.CLOUDINARY_API_KEY = cloudinaryEnv.CLOUDINARY_API_KEY;
    if (cloudinaryEnv.CLOUDINARY_API_SECRET) process.env.CLOUDINARY_API_SECRET = cloudinaryEnv.CLOUDINARY_API_SECRET;
  });

  t.beforeEach(async () => {
    mockProvider.clear();
    notificationQueue.clear();
    await Registration.deleteMany({});
    await Event.deleteMany({});
    await Club.deleteMany({});
    await PRMember.deleteMany({});
  });

  await t.test("1. Registration Submission triggers registration_submitted email", async () => {
    const club = await createTestClub("Robotics Club", "robotics");
    const event = await Event.create({
      name: "RoboWars 2026",
      slug: "robowars-2026",
      club: club._id,
      fee: 200,
      capacity: 50,
    });

    const result = await registrationService.createRegistration({
      studentName: "Nikola Tesla",
      studentEmail: "tesla@example.com",
      studentPhone: "9876543210",
      college: "Invention Tech",
      amount: 200,
      utr: "UTR12345678",
      eventSlug: event.slug,
      clubSlug: club.slug,
      paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/test_ss.jpg",
      paymentScreenshotPublicId: "zephyr-payments/test_ss",
    });

    assert.ok(result.id);
    assert.strictEqual(result.status, "pending");

    // Wait for queue to flush
    await notificationQueue.drain();

    assert.strictEqual(mockProvider.sentEmails.length, 1);
    const sent = mockProvider.sentEmails[0];
    assert.strictEqual(sent.to, "tesla@example.com");
    assert.ok(sent.subject.includes("RoboWars 2026"));
    assert.ok(sent.html.includes("Nikola Tesla"));
    assert.ok(sent.html.includes("Pending Verification"));
    assert.ok(sent.html.includes(result.id));
  });

  await t.test("2. Approval triggers registration_approved email and capacity alert when threshold met", async () => {
    const club = await createTestClub("AI Society", "ai-soc");
    const event = await Event.create({
      name: "ML Summit",
      slug: "ml-summit",
      club: club._id,
      fee: 100,
      capacity: 5,
      approvedCount: 3, // 3/5 = 60%, approving next reaches 4/5 = 80% (triggers capacity alert)
    });

    const reg = await Registration.create({
      studentName: "Grace Hopper",
      studentEmail: "hopper@example.com",
      amount: 100,
      event: event._id,
      club: club._id,
      status: "pending",
      paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v1/ss.jpg",
      paymentScreenshotPublicId: "zephyr-payments/ss_hopper",
    });

    const auth = {
      role: "club",
      clubId: club._id.toString(),
      email: "organizer@ai-soc.org",
    };

    const approveRes = await registrationReviewService.approveRegistration({
      id: reg._id.toString(),
      auth,
    });

    assert.strictEqual(approveRes.ok, true);
    assert.ok(approveRes.regNo);

    await notificationQueue.drain();

    // Attendee approval email + capacity alert email to admin
    const attendeeEmail = mockProvider.findEmailsByRecipient("hopper@example.com")[0];
    assert.ok(attendeeEmail);
    assert.ok(attendeeEmail.subject.includes("Confirmed: Your Registration"));
    assert.ok(attendeeEmail.html.includes(approveRes.regNo));
    assert.ok(attendeeEmail.html.includes("ML Summit"));

    const adminEmail = mockProvider.findEmailsByRecipient("organizer@ai-soc.org")[0];
    assert.ok(adminEmail);
    assert.ok(adminEmail.subject.includes("Capacity Warning"));
    assert.ok(adminEmail.html.includes("80%"));
  });

  await t.test("3. Correction request triggers correction_requested email with note", async () => {
    const club = await createTestClub("Web Devs", "web-devs");
    const event = await Event.create({
      name: "React Workshop",
      slug: "react-workshop",
      club: club._id,
    });

    const reg = await Registration.create({
      studentName: "Linus Torvalds",
      studentEmail: "linus@example.com",
      event: event._id,
      club: club._id,
      status: "pending",
      paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v1/ss.jpg",
      paymentScreenshotPublicId: "zephyr-payments/ss_linus",
    });

    const auth = {
      role: "club",
      clubId: club._id.toString(),
    };

    const correctionNote = "The UTR number is blurry. Please provide a clear screenshot.";
    const result = await registrationReviewService.requestCorrection({
      id: reg._id.toString(),
      note: correctionNote,
      auth,
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.data.status, "needs_correction");

    await notificationQueue.drain();

    assert.strictEqual(mockProvider.sentEmails.length, 1);
    const sent = mockProvider.sentEmails[0];
    assert.strictEqual(sent.to, "linus@example.com");
    assert.ok(sent.subject.includes("Action Required"));
    assert.ok(sent.html.includes(correctionNote));
  });

  await t.test("4. Rejection triggers registration_rejected email with reason", async () => {
    const club = await createTestClub("CyberSec Club", "cybersec");
    const event = await Event.create({
      name: "CTF 2026",
      slug: "ctf-2026",
      club: club._id,
    });

    const reg = await Registration.create({
      studentName: "Ken Thompson",
      studentEmail: "ken@example.com",
      event: event._id,
      club: club._id,
      status: "pending",
      paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v1/ss.jpg",
      paymentScreenshotPublicId: "zephyr-payments/ss_ken",
    });

    const auth = {
      role: "club",
      clubId: club._id.toString(),
    };

    const reason = "Payment transaction ID not found on bank statement.";
    const result = await registrationReviewService.rejectRegistration({
      id: reg._id.toString(),
      reason,
      auth,
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.status, "rejected");

    await notificationQueue.drain();

    assert.strictEqual(mockProvider.sentEmails.length, 1);
    const sent = mockProvider.sentEmails[0];
    assert.strictEqual(sent.to, "ken@example.com");
    assert.ok(sent.subject.includes("Registration Update"));
    assert.ok(sent.html.includes(reason));
  });

  await t.test("5. Provider failure is isolated and does not break database transaction or handler", async () => {
    mockProvider.setShouldFail(true, "SMTP Server Unreachable");

    const club = await createTestClub("Physics Club", "physics");
    const event = await Event.create({
      name: "Quantum Day",
      slug: "quantum-day",
      club: club._id,
    });

    const reg = await Registration.create({
      studentName: "Richard Feynman",
      studentEmail: "feynman@example.com",
      event: event._id,
      club: club._id,
      status: "pending",
      paymentScreenshot: "https://res.cloudinary.com/demo/image/upload/v1/ss.jpg",
      paymentScreenshotPublicId: "zephyr-payments/ss_feynman",
    });

    const auth = {
      role: "club",
      clubId: club._id.toString(),
    };

    // Approval succeeds even though email provider will fail asynchronously
    const approveRes = await registrationReviewService.approveRegistration({
      id: reg._id.toString(),
      auth,
    });

    assert.strictEqual(approveRes.ok, true);
    assert.strictEqual(approveRes.data.status, "approved");

    await notificationQueue.drain();

    const history = notificationQueue.getHistory();
    assert.ok(history.length > 0);
    // Queue caught provider failure without crashing
    assert.strictEqual(history[history.length - 1].result.ok, false);
    assert.strictEqual(history[history.length - 1].result.error, "SMTP Server Unreachable");

    // Verify DB update persisted despite email error
    const updated = await Registration.findById(reg._id);
    assert.strictEqual(updated.status, "approved");
  });
});
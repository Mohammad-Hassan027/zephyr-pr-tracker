import test from "node:test";
import assert from "node:assert/strict";
import { MockProvider } from "../services/email/providers/mock.provider.js";
import { ConsoleProvider } from "../services/email/providers/console.provider.js";
import { SmtpProvider } from "../services/email/providers/smtp.provider.js";
import { createEmailProvider } from "../services/email/providers/index.js";
import { renderEmailTemplate, htmlToPlainText } from "../services/email/templates/base.template.js";
import * as templates from "../services/email/templates/index.js";
import { NotificationQueueService } from "../services/email/notification-queue.service.js";
import { EmailService } from "../services/email/email.service.js";

test("Email Service Domain Suite", async (t) => {
  await t.test("1. Provider Abstraction & Factory", async () => {
    // Factory instantiates correctly based on provider type
    const mock = createEmailProvider({ provider: "mock" });
    assert.strictEqual(mock.name, "mock");

    const consoleP = createEmailProvider({ provider: "console" });
    assert.strictEqual(consoleP.name, "console");

    const smtp = createEmailProvider({ provider: "smtp", host: "localhost", port: 587 });
    assert.strictEqual(smtp.name, "smtp");

    // Mock provider captures sent emails and supports clearing
    const mockProvider = new MockProvider();
    const sendRes = await mockProvider.sendEmail({
      to: "student@example.com",
      subject: "Test Subject",
      html: "<p>Hello World</p>",
      text: "Hello World",
      metadata: { eventType: "registration_submitted", entityId: "reg-123" },
    });

    assert.strictEqual(sendRes.ok, true);
    assert.ok(sendRes.messageId);
    assert.strictEqual(mockProvider.sentEmails.length, 1);
    assert.strictEqual(mockProvider.getLatestEmail().to, "student@example.com");
    assert.strictEqual(mockProvider.findEmailsByEvent("registration_submitted").length, 1);

    mockProvider.clear();
    assert.strictEqual(mockProvider.sentEmails.length, 0);

    // Mock provider failure simulation
    mockProvider.setShouldFail(true, "Simulated SMTP timeout");
    const failRes = await mockProvider.sendEmail({ to: "fail@example.com", subject: "Fail" });
    assert.strictEqual(failRes.ok, false);
    assert.strictEqual(failRes.error, "Simulated SMTP timeout");
  });

  await t.test("2. Base Template & HTML to Plaintext Conversion", async () => {
    const html = renderEmailTemplate({
      title: "Welcome to CodeFest",
      contentHtml: "<p>Thank you for registering. Your <strong>pass</strong> is ready.</p><p><a href=\"https://example.com/status\">Click here</a></p>",
      statusBadge: "Approved",
      statusType: "approved",
      actionUrl: "https://example.com/status",
      actionText: "View Pass",
      clubName: "Coding Club",
      eventName: "CodeFest 2026",
    });

    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("Coding Club"));
    assert.ok(html.includes("CodeFest 2026"));
    assert.ok(html.includes("Approved"));
    assert.ok(html.includes("https://example.com/status"));
    assert.ok(html.includes("View Pass"));

    const text = htmlToPlainText(html);
    assert.ok(text.includes("Welcome to CodeFest"));
    assert.ok(text.includes("Coding Club"));
    assert.ok(text.includes("https://example.com/status"));
    assert.strictEqual(text.includes("<table"), false);
    assert.strictEqual(text.includes("<div"), false);
  });

  await t.test("3. All 10 Event Templates Generation", async () => {
    const dummyReg = {
      _id: "65f01a2b3c4d5e6f7a8b9c0d",
      studentName: "Ada Lovelace",
      studentEmail: "ada@example.com",
      amount: 250,
      utr: "UTR987654321",
      regNo: "ZEP-2026-0042",
      status: "pending",
      rejectionReason: "Invalid payment screenshot",
      correctionNote: "Please re-upload a clear screenshot showing transaction reference.",
    };

    const dummyEvent = {
      _id: "65f01a2b3c4d5e6f7a8b9c0e",
      name: "Hackathon 2026",
      venue: "Main Auditorium",
      date: new Date("2026-10-15T09:00:00Z"),
      capacity: 100,
      approvedCount: 85,
    };

    const dummyClub = {
      _id: "65f01a2b3c4d5e6f7a8b9c0f",
      name: "Computer Science Society",
      slug: "css",
    };

    const statusUrl = "https://zephyr.local/status/65f01a2b3c4d5e6f7a8b9c0d";
    const adminUrl = "https://zephyr.local/admin/css/events/hackathon-2026";

    // 1. Registration Submitted
    const t1 = templates.buildRegistrationSubmittedTemplate({ registration: dummyReg, event: dummyEvent, club: dummyClub, statusUrl });
    assert.ok(t1.subject.includes("Registration Received"));
    assert.ok(t1.html.includes("Ada Lovelace"));
    assert.ok(t1.html.includes("₹250"));
    assert.ok(t1.text.includes(statusUrl));

    // 2. Payment Proof Resubmitted
    const t2 = templates.buildPaymentProofUploadedTemplate({ registration: dummyReg, event: dummyEvent, club: dummyClub, statusUrl });
    assert.ok(t2.subject.includes("Payment Proof Resubmitted"));
    assert.ok(t2.html.includes("Under Review"));

    // 3. Registration Approved
    const t3 = templates.buildRegistrationApprovedTemplate({ registration: dummyReg, event: dummyEvent, club: dummyClub, statusUrl });
    assert.ok(t3.subject.includes("Confirmed: Your Registration"));
    assert.ok(t3.html.includes("ZEP-2026-0042"));
    assert.ok(t3.html.includes("Main Auditorium"));

    // 4. Registration Rejected
    const t4 = templates.buildRegistrationRejectedTemplate({ registration: dummyReg, event: dummyEvent, club: dummyClub, statusUrl, reason: "Invalid payment screenshot" });
    assert.ok(t4.subject.includes("Registration Update"));
    assert.ok(t4.html.includes("Invalid payment screenshot"));

    // 5. Correction Requested
    const t5 = templates.buildCorrectionRequestedTemplate({ registration: dummyReg, event: dummyEvent, club: dummyClub, statusUrl, correctionNote: "Please re-upload a clear screenshot" });
    assert.ok(t5.subject.includes("Action Required: Fix details"));
    assert.ok(t5.html.includes("Please re-upload a clear screenshot"));

    // 6. Capacity Alert
    const t6 = templates.buildEventCapacityNearlyFullTemplate({ event: dummyEvent, club: dummyClub, capacityInfo: { approvedCount: 85, capacity: 100, remaining: 15 }, adminUrl });
    assert.ok(t6.subject.includes("Capacity Warning"));
    assert.ok(t6.html.includes("85 / 100"));

    // 7. Event Closed / Full
    const t7 = templates.buildEventClosedTemplate({ event: dummyEvent, club: dummyClub, capacityInfo: { capacity: 100 }, adminUrl });
    assert.ok(t7.subject.includes("Capacity Reached"));
    assert.ok(t7.html.includes("100"));

    // 8. Waitlist Promotion
    const t8 = templates.buildWaitlistPromotionTemplate({ registration: dummyReg, event: dummyEvent, club: dummyClub, statusUrl });
    assert.ok(t8.subject.includes("Waitlist"));

    // 9. QR Entry Pass Generated
    const t9 = templates.buildQrEntryPassGeneratedTemplate({ registration: dummyReg, event: dummyEvent, club: dummyClub, statusUrl });
    assert.ok(t9.subject.includes("Your Entry Pass"));
    assert.ok(t9.html.includes("ZEP-2026-0042"));

    // 10. Registration Cancelled / Refunded
    const t10 = templates.buildRegistrationCancelledOrRefundedTemplate({ registration: dummyReg, event: dummyEvent, club: dummyClub, statusUrl, refundDetails: "Full refund of ₹250 initiated." });
    assert.ok(t10.subject.includes("Cancellation Notice"));
    assert.ok(t10.html.includes("Full refund of ₹250 initiated"));
  });

  await t.test("4. Notification Queue Deduplication & Non-Blocking Async Execution", async () => {
    const queue = new NotificationQueueService({ dedupTtlMs: 1000, concurrency: 2 });
    let executionCount = 0;

    const job1 = {
      entityType: "registration",
      entityId: "reg-1",
      eventType: "registration_approved",
      status: "approved",
      handler: async () => {
        executionCount++;
        return { ok: true };
      },
    };

    // First enqueue succeeds
    const res1 = queue.enqueue(job1);
    assert.strictEqual(res1.enqueued, true);

    // Immediate duplicate is suppressed
    const res2 = queue.enqueue(job1);
    assert.strictEqual(res2.enqueued, false);
    assert.strictEqual(res2.reason, "duplicate_suppressed");

    await queue.drain();
    assert.strictEqual(executionCount, 1);
    assert.strictEqual(queue.getHistory().length, 1);
    assert.strictEqual(queue.getHistory()[0].eventType, "registration_approved");

    queue.clear();
    assert.strictEqual(queue.size(), 0);
  });

  await t.test("5. EmailService High-Level Methods & Graceful Fallbacks", async () => {
    const mockProvider = new MockProvider();
    const queue = new NotificationQueueService();
    const service = new EmailService({ provider: mockProvider, queue });

    const dummyReg = {
      _id: "65f01a2b3c4d5e6f7a8b9c0d",
      studentName: "Alan Turing",
      studentEmail: "alan@example.com",
      amount: 0,
      status: "pending",
    };

    const dummyEvent = { _id: "e1", name: "Algorithms Seminar" };
    const dummyClub = { _id: "c1", name: "Turing Society", slug: "turing" };

    // Dispatches submitted email
    const submitRes = await service.sendRegistrationSubmitted(dummyReg, dummyEvent, dummyClub);
    assert.strictEqual(submitRes.enqueued, true);

    // Missing studentEmail returns graceful failure without throwing
    const missingEmailReg = { _id: "reg-no-email", studentName: "Anonymous" };
    const noEmailRes = await service.sendRegistrationSubmitted(missingEmailReg, dummyEvent, dummyClub);
    assert.strictEqual(noEmailRes.enqueued, false);
    assert.strictEqual(noEmailRes.reason, "missing_recipient_email");

    // Wait for queue drain and verify mock provider received email
    await queue.drain();
    assert.strictEqual(mockProvider.sentEmails.length, 1);
    assert.strictEqual(mockProvider.sentEmails[0].to, "alan@example.com");
    assert.ok(mockProvider.sentEmails[0].subject.includes("Algorithms Seminar"));
  });
});
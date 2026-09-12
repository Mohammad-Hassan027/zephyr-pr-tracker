import "dotenv/config";
import assert from "node:assert/strict";
import { setupTestDb, teardownTestDb } from "./setup-test-db.js";
import Club from "../models/Club.js";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import checkInService from "../services/registrations/check-in.service.js";
import registrationStatsService from "../services/registrations/registration-stats.service.js";
import { issueEntryPassToken } from "../services/registrations/entry-pass.service.js";

async function runCheckInIntegrationTests() {
  console.log("=== RUNNING CHECK-IN & ATTENDANCE INTEGRATION TESTS ===");

  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "12345678901234567890123456789012";
  await setupTestDb();

  const createTestClub = (name, slug) => {
    return Club.create({
      name,
      slug,
      email: `${slug}@zephyr.local`,
      passwordHash: "dummy-password-hash-1234567890",
      status: "approved",
    });
  };

  try {
    await Registration.deleteMany({});
    await Event.deleteMany({});
    await Club.deleteMany({});

    // 1. Approved vs Pending Entry Pass Retrieval
    console.log("\n[Test 1] Approved attendee can retrieve entry pass; pending/rejected cannot");
    const club = await createTestClub("Robotics Club", "robotics");
    const event = await Event.create({
      name: "RoboWars 2026",
      slug: "robowars-2026",
      club: club._id,
      venue: "Main Arena",
    });

    const approvedReg = await Registration.create({
      studentName: "Katherine Johnson",
      studentEmail: "katherine@nasa.gov",
      event: event._id,
      club: club._id,
      status: "approved",
      regNo: "ROBO-0001",
      paymentScreenshot: "https://example.com/ss.jpg",
    });

    const pendingReg = await Registration.create({
      studentName: "Dorothy Vaughan",
      studentEmail: "dorothy@nasa.gov",
      event: event._id,
      club: club._id,
      status: "pending",
      paymentScreenshot: "https://example.com/ss2.jpg",
    });

    const passRes = await checkInService.getEntryPassForRegistration(String(approvedReg._id));
    assert.strictEqual(passRes.ok, true);
    assert.ok(passRes.token);
    assert.ok(passRes.qrCodeDataUrl.startsWith("data:image/png;base64,"));
    assert.strictEqual(passRes.pass.regNo, "ROBO-0001");
    assert.strictEqual(passRes.pass.event.name, "RoboWars 2026");

    await assert.rejects(
      async () => checkInService.getEntryPassForRegistration(String(pendingReg._id)),
      { message: /only available for approved registrations/ }
    );
    console.log("✔ Approved pass issuance and pending rejection verified!");

    // 2. Gate verify and confirm check-in workflow
    console.log("\n[Test 2] Gate verify and confirm check-in workflow");
    const clubAI = await createTestClub("AI Society", "ai-soc");
    const eventAI = await Event.create({
      name: "Deep Learning Summit",
      slug: "dl-summit",
      club: clubAI._id,
    });

    const regAI = await Registration.create({
      studentName: "Geoffrey Hinton",
      studentEmail: "hinton@toronto.edu",
      event: eventAI._id,
      club: clubAI._id,
      status: "approved",
      regNo: "AI-0042",
      paymentScreenshot: "https://example.com/ss.jpg",
    });

    const authAI = {
      role: "club",
      clubId: clubAI._id.toString(),
      email: "staff@ai-soc.org",
    };

    const tokenAI = issueEntryPassToken({
      registration: regAI,
      event: eventAI,
      club: clubAI,
    });

    const preview = await checkInService.verifyCheckIn({
      token: tokenAI,
      eventSlug: "dl-summit",
      auth: authAI,
    });

    assert.strictEqual(preview.eligible, true);
    assert.strictEqual(preview.data.studentName, "Geoffrey Hinton");
    assert.strictEqual(preview.data.attendanceStatus, "not_marked");

    const confirmRes = await checkInService.confirmCheckIn({
      token: tokenAI,
      eventSlug: "dl-summit",
      source: "qr_scan",
      notes: "VIP Attendee Gate 1",
      auth: authAI,
    });

    assert.strictEqual(confirmRes.ok, true);
    assert.strictEqual(confirmRes.data.attendanceStatus, "present");
    assert.ok(confirmRes.data.checkedInAt);
    assert.strictEqual(confirmRes.data.checkInSource, "qr_scan");

    const updatedAI = await Registration.findById(regAI._id);
    assert.strictEqual(updatedAI.attendanceStatus, "present");
    assert.ok(updatedAI.checkedInAt);
    assert.strictEqual(updatedAI.checkInSource, "qr_scan");
    assert.strictEqual(updatedAI.history[updatedAI.history.length - 1].action, "check_in");
    console.log("✔ Gate verify and check-in confirmation verified!");

    // 3. Duplicate scan defense & authorized override
    console.log("\n[Test 3] Duplicate scan defense & authorized override");
    const clubCode = await createTestClub("Coding Club", "coding");
    const eventCode = await Event.create({
      name: "HackNight 2026",
      slug: "hacknight",
      club: clubCode._id,
    });

    const regCode = await Registration.create({
      studentName: "Ada Lovelace",
      studentEmail: "ada@poetical.science",
      event: eventCode._id,
      club: clubCode._id,
      status: "approved",
      regNo: "CODE-0007",
      paymentScreenshot: "https://example.com/ss.jpg",
      attendanceStatus: "present",
      checkedInAt: new Date(Date.now() - 3600000),
      checkedInBy: "admin",
      checkInSource: "qr_scan",
    });

    const authCode = {
      role: "club",
      clubId: clubCode._id.toString(),
    };

    const tokenCode = issueEntryPassToken({ registration: regCode, event: eventCode, club: clubCode });

    const previewDup = await checkInService.verifyCheckIn({ token: tokenCode, auth: authCode });
    assert.strictEqual(previewDup.eligible, false);
    assert.strictEqual(previewDup.alreadyCheckedIn, true);

    await assert.rejects(
      async () => checkInService.confirmCheckIn({ token: tokenCode, overrideDuplicate: false, auth: authCode }),
      (err) => {
        assert.ok(err.message.includes("already checked in"));
        assert.strictEqual(err.statusCode, 409);
        return true;
      }
    );

    const overrideRes = await checkInService.confirmCheckIn({
      token: tokenCode,
      overrideDuplicate: true,
      notes: "Re-entry after dinner break",
      auth: authCode,
    });

    assert.strictEqual(overrideRes.ok, true);
    assert.strictEqual(overrideRes.data.checkInSource, "override");
    assert.strictEqual(overrideRes.data.history[overrideRes.data.history.length - 1].action, "check_in_override");
    console.log("✔ Duplicate scan protection and admin override verified!");

    // 4. Multi-tenant & Event isolation
    console.log("\n[Test 4] Multi-tenant & Event isolation prevents cross-checkin");
    const clubA = await createTestClub("Club Alpha", "alpha");
    const clubB = await createTestClub("Club Beta", "beta");

    const eventA = await Event.create({ name: "Alpha Fest", slug: "alpha-fest", club: clubA._id });
    const eventB = await Event.create({ name: "Beta Fest", slug: "beta-fest", club: clubB._id });

    const regA = await Registration.create({
      studentName: "Student Alpha",
      studentEmail: "alpha@example.com",
      event: eventA._id,
      club: clubA._id,
      status: "approved",
      regNo: "ALP-001",
      paymentScreenshot: "https://example.com/ss.jpg",
    });

    const tokenA = issueEntryPassToken({ registration: regA, event: eventA, club: clubA });

    const authClubB = {
      role: "club",
      clubId: clubB._id.toString(),
    };

    await assert.rejects(
      async () => checkInService.verifyCheckIn({ token: tokenA, auth: authClubB }),
      { statusCode: 403 }
    );

    const authClubA = {
      role: "club",
      clubId: clubA._id.toString(),
    };

    await assert.rejects(
      async () => checkInService.verifyCheckIn({ token: tokenA, eventSlug: "beta-fest", auth: authClubA }),
      { statusCode: 409 }
    );
    console.log("✔ Multi-tenant and event isolation verified!");

    // 5. Manual lookup fallback and attendance statistics
    console.log("\n[Test 5] Manual lookup fallback and attendance statistics");
    const clubDesign = await createTestClub("Design Guild", "design");
    const eventDesign = await Event.create({
      name: "UI/UX Workshop",
      slug: "ui-ux",
      club: clubDesign._id,
    });

    await Registration.create([
      {
        studentName: "Jony Ive",
        studentEmail: "jony@apple.com",
        studentPhone: "9876500001",
        event: eventDesign._id,
        club: clubDesign._id,
        status: "approved",
        regNo: "DSGN-0001",
        attendanceStatus: "present",
        checkedInAt: new Date(),
        paymentScreenshot: "https://example.com/ss1.jpg",
      },
      {
        studentName: "Dieter Rams",
        studentEmail: "dieter@braun.de",
        studentPhone: "9876500002",
        event: eventDesign._id,
        club: clubDesign._id,
        status: "approved",
        regNo: "DSGN-0002",
        attendanceStatus: "not_marked",
        paymentScreenshot: "https://example.com/ss2.jpg",
      },
      {
        studentName: "Massimo Vignelli",
        studentEmail: "massimo@design.it",
        studentPhone: "9876500003",
        event: eventDesign._id,
        club: clubDesign._id,
        status: "pending",
        paymentScreenshot: "https://example.com/ss3.jpg",
      },
    ]);

    const authDesign = {
      role: "club",
      clubId: clubDesign._id.toString(),
    };

    const lookup1 = await checkInService.lookupAttendees({
      search: "Dieter",
      eventSlug: "ui-ux",
      auth: authDesign,
    });
    assert.strictEqual(lookup1.count, 1);
    assert.strictEqual(lookup1.items[0].regNo, "DSGN-0002");

    const lookup2 = await checkInService.lookupAttendees({
      search: "DSGN",
      eventSlug: "ui-ux",
      auth: authDesign,
    });
    assert.strictEqual(lookup2.count, 2);

    const manualCheckIn = await checkInService.confirmCheckIn({
      regNo: "DSGN-0002",
      eventSlug: "ui-ux",
      source: "manual",
      notes: "Manual check-in at front desk",
      auth: authDesign,
    });
    assert.strictEqual(manualCheckIn.ok, true);
    assert.strictEqual(manualCheckIn.data.attendanceStatus, "present");

    const stats = await registrationStatsService.getStatsSummary(authDesign);
    const eventStat = stats.find((s) => s.slug === "ui-ux");
    assert.ok(eventStat);
    assert.strictEqual(eventStat.count, 2);
    assert.strictEqual(eventStat.checkedInCount, 2);
    assert.strictEqual(eventStat.attendanceRate, 100);
    console.log("✔ Manual lookup and attendance statistics verified!");

    console.log("\n=== ALL CHECK-IN INTEGRATION TESTS PASSED ===");
  } finally {
    await teardownTestDb();
  }
}

runCheckInIntegrationTests().catch((err) => {
  console.error("Check-in Integration Test Failed:", err);
  process.exit(1);
});
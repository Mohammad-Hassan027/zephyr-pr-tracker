/**
 * seed-presentation.js
 *
 * Clean, idempotent presentation/demo data seeder for Zephyr PR Tracker.
 * Seeds realistic fictional data for clubs, events, PR team members,
 * and participant registrations across all lifecycle workflows.
 *
 * Safety guarantees:
 * - Deterministic lookup keys: safe to execute repeatedly without duplicating data.
 * - Non-destructive: never deletes unrelated production or user records.
 * - Idempotent capacity reconciliation: maintains exact Event.approvedCount invariants.
 * - Credentials safe: does not log passwords or PINs.
 *
 * Usage:
 *   node scripts/seed-presentation.js
 *   npm run seed:presentation
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

import Club from "../models/Club.js";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import Registration from "../models/Registration.js";

// Load environment variables (.env and optional local .presentation-credentials)
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const credsPath = path.join(__dirname, "..", ".presentation-credentials");
if (fs.existsSync(credsPath)) {
  dotenv.config({ path: credsPath, override: true });
}

// Presentation Club Specification
const PRESENTATION_CLUB = {
  name: "Zephyr Tech Society",
  slug: "presentation-zephyr-tech",
  email: process.env.DEMO_CLUB_EMAIL || "admin@zephyr-demo.example.com",
  password: process.env.DEMO_CLUB_PASSWORD || "DemoAdminPass123!",
  status: "approved",
};

// Presentation Events Specification
const PRESENTATION_EVENTS = [
  {
    name: "Zephyr Coding War 2026",
    slug: "presentation-coding-war",
    description: "Annual inter-collegiate competitive programming and algorithms championship.",
    venue: "Turing Auditorium, Computing Block",
    fee: 150,
    capacity: 100,
    date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days in future
  },
  {
    name: "Cloud & AI Architecture Workshop",
    slug: "presentation-cloud-workshop",
    description: "Hands-on masterclass in building resilient cloud-native applications with Next.js and AI integrations.",
    venue: "Seminar Hall B, Innovation Hub",
    fee: 100,
    capacity: 60,
    date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days in future
  },
  {
    name: "Campus Cryptic Treasure Hunt",
    slug: "presentation-treasure-hunt",
    description: "Campus-wide cryptic riddle trail and tech puzzle challenge.",
    venue: "Central Campus Lawn",
    fee: 50,
    capacity: 50,
    date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days in future
  },
];

// Presentation PR Members Specification
const DEFAULT_PR_PIN = process.env.DEMO_PR_PIN || "654321";
const PRESENTATION_MEMBERS = [
  { name: "Alex Morgan", code: "ALEX101", pin: DEFAULT_PR_PIN },
  { name: "Samira Khan", code: "SAMIRA202", pin: DEFAULT_PR_PIN },
  { name: "Jordan Lee", code: "JORDAN303", pin: DEFAULT_PR_PIN },
  { name: "Taylor Patel", code: "TAYLOR404", pin: DEFAULT_PR_PIN },
];

// Presentation Registrations Specification
const PRESENTATION_REGISTRATIONS = [
  // Event 1: Coding War (Approved with check-in)
  {
    seedId: "pres-reg-001",
    studentName: "Aarav Sharma",
    studentEmail: "aarav.sharma@demo.example.com",
    studentPhone: "9876500001",
    college: "Institute of Engineering & Technology",
    amount: 150,
    utr: "DEMOUTR100001",
    eventSlug: "presentation-coding-war",
    referralCode: "ALEX101",
    status: "approved",
    regNo: "ZP-0101",
    reviewedBy: "ALEX101",
    attendanceStatus: "present",
    checkedInBy: "ALEX101",
    checkInSource: "qr_scan",
    paymentScreenshot: "https://placehold.co/600x800/png?text=Payment+Proof+001",
  },
  // Event 1: Coding War (Approved not checked-in)
  {
    seedId: "pres-reg-002",
    studentName: "Diya Patel",
    studentEmail: "diya.patel@demo.example.com",
    studentPhone: "9876500002",
    college: "Metropolitan Technical University",
    amount: 150,
    utr: "DEMOUTR100002",
    eventSlug: "presentation-coding-war",
    referralCode: "ALEX101",
    status: "approved",
    regNo: "ZP-0102",
    reviewedBy: "ALEX101",
    attendanceStatus: "not_marked",
    paymentScreenshot: "https://placehold.co/600x800/png?text=Payment+Proof+002",
  },
  // Event 1: Coding War (Pending review)
  {
    seedId: "pres-reg-003",
    studentName: "Ishaan Verma",
    studentEmail: "ishaan.verma@demo.example.com",
    studentPhone: "9876500003",
    college: "State Science & Tech Institute",
    amount: 150,
    utr: "DEMOUTR100003",
    eventSlug: "presentation-coding-war",
    referralCode: "SAMIRA202",
    status: "pending",
    paymentScreenshot: "https://placehold.co/600x800/png?text=Payment+Proof+003",
  },
  // Event 1: Coding War (Needs correction)
  {
    seedId: "pres-reg-004",
    studentName: "Ananya Iyer",
    studentEmail: "ananya.iyer@demo.example.com",
    studentPhone: "9876500004",
    college: "City Polytechnic College",
    amount: 150,
    utr: "DEMOUTR100004",
    eventSlug: "presentation-coding-war",
    referralCode: "JORDAN303",
    status: "needs_correction",
    correctionNote: "Transaction screenshot is blurry. Please re-upload a clear receipt showing the 12-digit UTR.",
    lastCorrectionRequestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    paymentScreenshot: "https://placehold.co/600x800/png?text=Blurry+Proof+004",
    history: [
      {
        action: "correction_requested",
        status: "needs_correction",
        performedBy: "JORDAN303",
        note: "Transaction screenshot is blurry. Please re-upload a clear receipt showing the 12-digit UTR.",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ],
  },
  // Event 1: Coding War (Resubmitted)
  {
    seedId: "pres-reg-005",
    studentName: "Rohan Gupta",
    studentEmail: "rohan.gupta@demo.example.com",
    studentPhone: "9876500005",
    college: "Federal Engineering College",
    amount: 150,
    utr: "DEMOUTR100005",
    eventSlug: "presentation-coding-war",
    referralCode: "TAYLOR404",
    status: "resubmitted",
    correctionNote: "Initial screenshot had cropped reference number.",
    resubmittedAt: new Date(Date.now() - 30 * 60 * 1000),
    paymentScreenshot: "https://placehold.co/600x800/png?text=Resubmitted+Proof+005",
    history: [
      {
        action: "correction_requested",
        status: "needs_correction",
        performedBy: "TAYLOR404",
        note: "Initial screenshot had cropped reference number.",
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        action: "resubmitted",
        status: "resubmitted",
        performedBy: "student",
        note: "Updated payment receipt with full UTR visible.",
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
      },
    ],
  },
  // Event 1: Coding War (Rejected)
  {
    seedId: "pres-reg-006",
    studentName: "Kabir Mehta",
    studentEmail: "kabir.mehta@demo.example.com",
    studentPhone: "9876500006",
    college: "Apex College of Computing",
    amount: 150,
    utr: "DEMOUTR100006",
    eventSlug: "presentation-coding-war",
    referralCode: "ALEX101",
    status: "rejected",
    reviewedBy: "ALEX101",
    rejectionReason: "Payment amount does not match event fee.",
    paymentScreenshot: "https://placehold.co/600x800/png?text=Invalid+Amount+Proof+006",
  },
  // Event 2: Cloud Workshop (Approved & Direct/Organic)
  {
    seedId: "pres-reg-007",
    studentName: "Pari Joshi",
    studentEmail: "pari.joshi@demo.example.com",
    studentPhone: "9876500007",
    college: "Global Institute of Technology",
    amount: 100,
    utr: "DEMOUTR100007",
    eventSlug: "presentation-cloud-workshop",
    referralCode: null,
    status: "approved",
    regNo: "ZP-0201",
    reviewedBy: "admin",
    attendanceStatus: "present",
    checkedInBy: "admin",
    checkInSource: "manual",
    paymentScreenshot: "https://placehold.co/600x800/png?text=Payment+Proof+007",
  },
  // Event 2: Cloud Workshop (Approved)
  {
    seedId: "pres-reg-008",
    studentName: "Vivaan Reddy",
    studentEmail: "vivaan.reddy@demo.example.com",
    studentPhone: "9876500008",
    college: "Institute of Engineering & Technology",
    amount: 100,
    utr: "DEMOUTR100008",
    eventSlug: "presentation-cloud-workshop",
    referralCode: "SAMIRA202",
    status: "approved",
    regNo: "ZP-0202",
    reviewedBy: "SAMIRA202",
    attendanceStatus: "not_marked",
    paymentScreenshot: "https://placehold.co/600x800/png?text=Payment+Proof+008",
  },
  // Event 2: Cloud Workshop (Suspicious flagged, marked legitimate)
  {
    seedId: "pres-reg-009",
    studentName: "Sara Nair",
    studentEmail: "sara.nair@demo.example.com",
    studentPhone: "9876500009",
    college: "Metropolitan Technical University",
    amount: 100,
    utr: "DEMOUTR100009",
    eventSlug: "presentation-cloud-workshop",
    referralCode: "JORDAN303",
    status: "approved",
    regNo: "ZP-0203",
    reviewedBy: "JORDAN303",
    attendanceStatus: "not_marked",
    paymentScreenshot: "https://placehold.co/600x800/png?text=Payment+Proof+009",
    suspicionFlags: {
      isSuspicious: true,
      signals: [
        {
          signal: "SIMILAR_NAME_MATCHING_CONTACT",
          reason: "Similar contact details noted during registration intake.",
          confidence: "medium",
          detectedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        },
      ],
      resolution: {
        status: "marked_legitimate",
        resolvedBy: "JORDAN303",
        resolvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        notes: "Verified bank transfer slip directly with student.",
      },
    },
  },
  // Event 3: Treasure Hunt (Pending review)
  {
    seedId: "pres-reg-010",
    studentName: "Arjun Rao",
    studentEmail: "arjun.rao@demo.example.com",
    studentPhone: "9876500010",
    college: "Fr. CRCE Tech Campus",
    amount: 50,
    utr: "DEMOUTR100010",
    eventSlug: "presentation-treasure-hunt",
    referralCode: "TAYLOR404",
    status: "pending",
    paymentScreenshot: "https://placehold.co/600x800/png?text=Payment+Proof+010",
  },
];

/**
 * Executes idempotent presentation data seeding.
 *
 * @param {Object} [options]
 * @param {boolean} [options.disconnectOnComplete=true] Whether to disconnect mongoose on completion
 * @param {boolean} [options.silent=false] Suppress console logs
 * @returns {Promise<Object>} Seeding statistics summary
 */
export async function seedPresentation({ disconnectOnComplete = true, silent = false } = {}) {
  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error(
      "? Error: MONGO_URI environment variable is required to run the presentation seeder."
    );
    throw new Error("MONGO_URI environment variable is missing");
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
    log("? Connected to MongoDB");
  }

  const stats = {
    clubs: { created: 0, updated: 0 },
    events: { created: 0, updated: 0 },
    members: { created: 0, updated: 0 },
    registrations: { created: 0, updated: 0 },
  };

  // 1. Seed or Update Presentation Club
  const clubPasswordHash = await bcrypt.hash(PRESENTATION_CLUB.password, 10);
  let club = await Club.findOne({ slug: PRESENTATION_CLUB.slug });

  if (!club) {
    club = await Club.create({
      name: PRESENTATION_CLUB.name,
      slug: PRESENTATION_CLUB.slug,
      email: PRESENTATION_CLUB.email,
      passwordHash: clubPasswordHash,
      status: PRESENTATION_CLUB.status,
    });
    stats.clubs.created++;
  } else {
    club.name = PRESENTATION_CLUB.name;
    club.email = PRESENTATION_CLUB.email;
    club.passwordHash = clubPasswordHash;
    club.status = PRESENTATION_CLUB.status;
    await club.save();
    stats.clubs.updated++;
  }

  // 2. Seed or Update Presentation Events (dynamically future-dated)
  const now = Date.now();
  const dynamicEvents = [
    { ...PRESENTATION_EVENTS[0], date: new Date(now + 30 * 24 * 60 * 60 * 1000) },
    { ...PRESENTATION_EVENTS[1], date: new Date(now + 45 * 24 * 60 * 60 * 1000) },
    { ...PRESENTATION_EVENTS[2], date: new Date(now + 60 * 24 * 60 * 60 * 1000) },
  ];

  const eventMap = new Map();
  for (const eventSpec of dynamicEvents) {
    let event = await Event.findOne({ club: club._id, slug: eventSpec.slug });
    if (!event) {
      event = await Event.create({
        name: eventSpec.name,
        slug: eventSpec.slug,
        description: eventSpec.description,
        venue: eventSpec.venue,
        fee: eventSpec.fee,
        capacity: eventSpec.capacity,
        date: eventSpec.date,
        status: "open",
        approvedCount: 0,
        club: club._id,
      });
      stats.events.created++;
    } else {
      event.name = eventSpec.name;
      event.description = eventSpec.description;
      event.venue = eventSpec.venue;
      event.fee = eventSpec.fee;
      event.capacity = eventSpec.capacity;
      event.date = eventSpec.date;
      event.status = "open";
      await event.save();
      stats.events.updated++;
    }
    eventMap.set(event.slug, event);
  }

  // 3. Seed or Update Presentation PR Members
  const memberMap = new Map();
  for (const memberSpec of PRESENTATION_MEMBERS) {
    const passwordHash = await bcrypt.hash(memberSpec.pin, 10);
    let member = await PRMember.findOne({ club: club._id, code: memberSpec.code });
    if (!member) {
      member = await PRMember.create({
        name: memberSpec.name,
        code: memberSpec.code,
        passwordHash,
        club: club._id,
        tokenVersion: 1,
      });
      stats.members.created++;
    } else {
      member.name = memberSpec.name;
      member.passwordHash = passwordHash;
      member.tokenVersion = 1;
      await member.save();
      stats.members.updated++;
    }
    memberMap.set(member.code, member);
  }

  // 4. Seed or Update Presentation Registrations
  for (const regSpec of PRESENTATION_REGISTRATIONS) {
    const targetEvent = eventMap.get(regSpec.eventSlug);
    if (!targetEvent) continue;

    const normalizedEmail = regSpec.studentEmail.toLowerCase().trim();
    const normalizedPhone = regSpec.studentPhone.trim();
    const normalizedUtr = regSpec.utr ? regSpec.utr.toUpperCase().trim() : "";

    const registrationData = {
      studentName: regSpec.studentName,
      studentEmail: regSpec.studentEmail,
      studentPhone: regSpec.studentPhone,
      normalizedEmail,
      normalizedPhone,
      college: regSpec.college,
      amount: regSpec.amount,
      utr: regSpec.utr,
      normalizedUtr,
      event: targetEvent._id,
      club: club._id,
      referralCode: regSpec.referralCode,
      paymentScreenshot: regSpec.paymentScreenshot,
      status: regSpec.status,
      regNo: regSpec.regNo || undefined,
      reviewedBy: regSpec.reviewedBy || null,
      rejectionReason: regSpec.rejectionReason || null,
      correctionNote: regSpec.correctionNote || null,
      lastCorrectionRequestedAt: regSpec.lastCorrectionRequestedAt || null,
      resubmittedAt: regSpec.resubmittedAt || null,
      attendanceStatus: regSpec.attendanceStatus || "not_marked",
      checkedInAt: regSpec.attendanceStatus === "present" ? new Date() : null,
      checkedInBy: regSpec.checkedInBy || null,
      checkInSource: regSpec.checkInSource || null,
      customFields: {
        presentationSeedId: regSpec.seedId,
      },
      suspicionFlags: regSpec.suspicionFlags || {
        isSuspicious: false,
        signals: [],
        resolution: { status: "pending" },
      },
      history: regSpec.history || [],
    };

    // Deterministic lookup key using customFields.presentationSeedId and club
    let reg = await Registration.findOne({
      club: club._id,
      "customFields.presentationSeedId": regSpec.seedId,
    });

    if (!reg) {
      await Registration.create(registrationData);
      stats.registrations.created++;
    } else {
      Object.assign(reg, registrationData);
      await reg.save();
      stats.registrations.updated++;
    }
  }

  // 5. Reconcile Event.approvedCount for presentation events
  for (const [slug, event] of eventMap.entries()) {
    const approvedCount = await Registration.countDocuments({
      event: event._id,
      status: "approved",
    });
    event.approvedCount = approvedCount;
    await event.save();
  }

  log("\n========================================================");
  log("✔ Presentation Data Seeding Completed Successfully");
  log("========================================================");
  log(`  Clubs:         Created: ${stats.clubs.created}, Updated: ${stats.clubs.updated}`);
  log(`  Events:        Created: ${stats.events.created}, Updated: ${stats.events.updated}`);
  log(`  PR Members:    Created: ${stats.members.created}, Updated: ${stats.members.updated}`);
  log(`  Registrations: Created: ${stats.registrations.created}, Updated: ${stats.registrations.updated}`);
  log("--------------------------------------------------------");
  log("  Active Presentation Events:");
  for (const [slug, event] of eventMap.entries()) {
    log(`   • ${event.name.padEnd(35)} [slug: ${slug}] (Approved: ${event.approvedCount}/${event.capacity ?? "unlimited"})`);
  }
  log("  PR Team Members:");
  for (const [code, member] of memberMap.entries()) {
    log(`   • ${member.name.padEnd(20)} [Referral Code: ${code}]`);
  }
  log("========================================================\n");

  if (disconnectOnComplete && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    log("✔ Disconnected cleanly from MongoDB");
  }

  return stats;
}

// Direct invocation handler
if (process.argv[1] && process.argv[1].endsWith("seed-presentation.js")) {
  seedPresentation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Presentation seeding failed:", err.message);
      process.exit(1);
    });
}


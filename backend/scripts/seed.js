// Generates realistic test data: events, PR members (with usable login PINs),
// and registrations spread across pending/approved/rejected so every screen
// (dashboard, leaderboard, PR queue, admin) has something to show.
//
// Run: npm run seed          (clears existing data first)
//      npm run seed -- --keep   (skip the clear step, just adds more)

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import Registration from "../models/Registration.js";
import Counter, { nextSequence } from "../models/Counter.js";

dotenv.config();

const FIRST_NAMES = [
  "Aarav",
  "Vivaan",
  "Aditya",
  "Sai",
  "Reyansh",
  "Ishaan",
  "Kabir",
  "Arjun",
  "Ananya",
  "Diya",
  "Aadhya",
  "Myra",
  "Sara",
  "Pari",
  "Anika",
  "Riya",
];
const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Gupta",
  "Patel",
  "Iyer",
  "Khan",
  "Reddy",
  "Nair",
  "Joshi",
  "Mehta",
  "Singh",
  "Rao",
];
const COLLEGES = [
  "Thakur College of Engineering & Technology",
  "VESIT",
  "SPIT",
  "KJ Somaiya",
  "DJ Sanghvi",
  "Fr. CRCE",
];
const EVENTS = [
  { name: "Coding War", slug: "coding-war", capacity: 100 },
  { name: "Box Cricket", slug: "box-cricket", capacity: 80 },
  { name: "Dance Battle", slug: "dance-battle", capacity: 60 },
  { name: "Robo Race", slug: "robo-race", capacity: 40 },
  { name: "Treasure Hunt", slug: "treasure-hunt", capacity: 50 },
];
const PR_MEMBERS = ["Rahul Sharma", "Sneha Patil", "Aman Khan", "Priya Desai"];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// weighted status pick: 40% pending, 45% approved, 15% rejected
function randomStatus() {
  const r = Math.random();
  if (r < 0.4) return "pending";
  if (r < 0.85) return "approved";
  return "rejected";
}

async function seed() {
  const keep = process.argv.includes("--keep");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  if (!keep) {
    await Promise.all([
      Event.deleteMany({}),
      PRMember.deleteMany({}),
      Registration.deleteMany({}),
      Counter.deleteMany({}),
    ]);
    console.log("Cleared existing data");
  }

  // --- Events ---
  const events = await Event.insertMany(
    EVENTS.map((e) => ({ ...e, date: new Date("2026-08-10") })),
  );
  console.log(`Created ${events.length} events`);

  // --- PR members (prints login PINs — copy these to test /pr) ---
  const members = [];
  console.log("\nPR member logins:");
  for (const name of PR_MEMBERS) {
    const code = name.split(" ")[0].toUpperCase() + randInt(100, 999);
    const pin = String(randInt(100000, 999999));
    const passwordHash = await bcrypt.hash(pin, 10);
    const member = await PRMember.create({ name, code, passwordHash });
    members.push(member);
    console.log(`  ${name.padEnd(14)} code=${code}  pin=${pin}`);
  }

  // --- Registrations ---
  let created = 0;
  for (let i = 0; i < 60; i++) {
    const event = rand(events);
    const useReferral = Math.random() < 0.7;
    const referralCode = useReferral ? rand(members).code : null;
    const status = randomStatus();

    const doc = {
      studentName: `${rand(FIRST_NAMES)} ${rand(LAST_NAMES)}`,
      studentEmail: `student${i}@test.com`, // indexed to stay unique across events
      studentPhone: `9${randInt(100000000, 999999999)}`,
      college: rand(COLLEGES),
      amount: rand([100, 150, 200, 250]),
      event: event._id,
      referralCode,
      paymentScreenshot: `https://picsum.photos/seed/reg${i}/400/600`, // placeholder, no Cloudinary needed for test data
      status,
    };

    if (status === "approved") {
      const seq = await nextSequence("regNo");
      doc.regNo = `ZP${String(seq).padStart(4, "0")}`;
      doc.reviewedBy = referralCode || "admin";
    }
    if (status === "rejected") {
      doc.reviewedBy = referralCode || "admin";
      doc.rejectionReason = rand([
        "Screenshot unclear",
        "Amount mismatch",
        "Duplicate payment",
      ]);
    }

    await Registration.create(doc);
    created++;
  }
  console.log(`\nCreated ${created} registrations`);

  const counts = await Registration.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  console.log(
    "Status breakdown:",
    Object.fromEntries(counts.map((c) => [c._id, c.count])),
  );

  await mongoose.disconnect();
  console.log("\nDone.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

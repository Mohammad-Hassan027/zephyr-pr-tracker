import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import readline from "node:readline";
import Club from "../models/Club.js";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import Registration from "../models/Registration.js";

dotenv.config();

function promptInput(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function migrate() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI environment variable");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  // 1. Get or create default "Zephyr" club
  let club = await Club.findOne({ slug: "zephyr" });

  if (!club) {
    console.log("Default 'Zephyr' club not found. Preparing to create one...");

    let email = process.env.ZEPHYR_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    if (!email) {
      if (process.stdin.isTTY) {
        email = await promptInput("Enter Zephyr Club admin email: ");
      }
      if (!email) {
        email = "admin@zephyr.org";
        console.log(`Using default fallback email: ${email}`);
      }
    }

    let password = process.env.ZEPHYR_ADMIN_PASSWORD || process.env.PR_ADMIN_PASSWORD;
    if (!password) {
      if (process.stdin.isTTY) {
        password = await promptInput("Enter Zephyr Club admin password: ");
      }
      if (!password) {
        password = "zephyrpassword123";
        console.log("Using default fallback password");
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    club = await Club.create({
      name: "Zephyr",
      slug: "zephyr",
      email: String(email).trim().toLowerCase(),
      passwordHash,
    });
    console.log(`Created default Club: ${club.name} (${club.slug}) with email: ${club.email}`);
  } else {
    console.log(`Using existing default Club: ${club.name} (${club.slug}) [ID: ${club._id}]`);
  }

  // 2. Bulk update documents missing a club reference
  const unassignedFilter = {
    $or: [{ club: { $exists: false } }, { club: null }],
  };

  const [eventRes, memberRes, regRes] = await Promise.all([
    Event.updateMany(unassignedFilter, { $set: { club: club._id } }),
    PRMember.updateMany(unassignedFilter, { $set: { club: club._id } }),
    Registration.updateMany(unassignedFilter, { $set: { club: club._id } }),
  ]);

  console.log("\n--- Migration Backfill Summary ---");
  console.log(`Events backfilled:        ${eventRes.modifiedCount}`);
  console.log(`PR Members backfilled:    ${memberRes.modifiedCount}`);
  console.log(`Registrations backfilled: ${regRes.modifiedCount}`);
  console.log("----------------------------------\n");

  await mongoose.disconnect();
  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});

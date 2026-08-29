/**
 * Migration: Backfill Event.approvedCount
 *
 * Sets approvedCount on every Event document to match the current count of
 * approved Registration documents for that event.
 *
 * Idempotent — safe to run multiple times (uses $set, not $inc).
 * Run once before deploying the capacity-reservation feature to production.
 *
 * Usage:
 *   MONGODB_URI=<uri> node scripts/migrate-event-capacity.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";

dotenv.config();

export async function migrateEventCapacity() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("❌  MONGODB_URI (or MONGO_URI) environment variable is missing.");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("✔  Connected to MongoDB for Event.approvedCount migration...\n");

    const events = await Event.find({}).select("_id name slug capacity approvedCount").lean();
    console.log(`   Found ${events.length} event(s) to process.`);

    if (events.length === 0) {
      console.log("   Nothing to migrate.");
      return;
    }

    const eventIds = events.map((e) => e._id);

    // Aggregate actual approved counts from Registration collection (ground truth)
    const actualCounts = await Registration.aggregate([
      { $match: { event: { $in: eventIds }, status: "approved" } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);

    const actualCountMap = Object.fromEntries(
      actualCounts.map((item) => [String(item._id), item.count])
    );

    let updatedCount = 0;
    let skippedCount = 0;

    for (const ev of events) {
      const actual = actualCountMap[String(ev._id)] ?? 0;
      const current = ev.approvedCount ?? 0;

      if (actual === current) {
        skippedCount++;
        continue;
      }

      await Event.findByIdAndUpdate(ev._id, { $set: { approvedCount: actual } });
      console.log(
        `   Updated "${ev.name}" (${ev.slug}): approvedCount ${current} → ${actual}` +
          (ev.capacity ? ` (capacity: ${ev.capacity})` : " (unlimited)")
      );
      updatedCount++;
    }

    console.log(
      `\n✔  Migration completed.` +
        `\n   Updated : ${updatedCount} event(s)` +
        `\n   Skipped : ${skippedCount} event(s) (already consistent)`
    );
  } catch (err) {
    console.error("❌  Migration failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run when executed directly
if (process.argv[1] && process.argv[1].endsWith("migrate-event-capacity.js")) {
  migrateEventCapacity();
}

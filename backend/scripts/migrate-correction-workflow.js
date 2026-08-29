import mongoose from "mongoose";
import dotenv from "dotenv";
import Registration from "../models/Registration.js";

dotenv.config();

export async function migrateCorrectionWorkflow() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI environment variable is missing.");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for correction workflow migration...");

    const cursor = Registration.find({
      $or: [{ history: { $exists: false } }, { history: { $size: 0 } }],
    }).cursor();

    let updatedCount = 0;

    for (let reg = await cursor.next(); reg != null; reg = await cursor.next()) {
      const historyEntry = {
        action: reg.status === "approved" ? "approved" : reg.status === "rejected" ? "rejected" : "submitted",
        status: reg.status || "pending",
        performedBy: reg.reviewedBy || "contributor",
        note: reg.rejectionReason || reg.correctionNote || null,
        timestamp: reg.updatedAt || reg.createdAt || new Date(),
      };

      const initialEntry = {
        action: "submitted",
        status: "pending",
        performedBy: "contributor",
        note: "Initial submission",
        timestamp: reg.createdAt || new Date(),
      };

      reg.history = reg.status === "pending" ? [initialEntry] : [initialEntry, historyEntry];
      await reg.save();
      updatedCount++;
    }

    console.log(`Migration completed successfully. Updated ${updatedCount} registrations.`);
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith("migrate-correction-workflow.js")) {
  migrateCorrectionWorkflow();
}

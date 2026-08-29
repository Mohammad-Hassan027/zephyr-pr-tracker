import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: "" },
    venue: { type: String, default: "" },
    fee: { type: Number, default: 0 },
    date: { type: Date },
    capacity: { type: Number, default: null }, // null = unlimited
    /**
     * Atomic counter of currently approved registrations.
     * Incremented via reserveEventCapacity() and decremented via releaseEventCapacity()
     * using findOneAndUpdate with conditional filters to prevent race conditions.
     *
     * Invariant: 0 <= approvedCount <= capacity (when capacity is not null)
     */
    approvedCount: { type: Number, default: 0, min: 0 },
    club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  },
  { timestamps: true }
);

eventSchema.index({ club: 1, slug: 1 }, { unique: true });

/**
 * Pre-save guard: enforce 0 <= approvedCount <= capacity invariant.
 * This is a last-resort safety net; the primary enforcement is done
 * atomically in the repository layer via conditional findOneAndUpdate.
 */
eventSchema.pre("save", function (next) {
  if (this.approvedCount < 0) {
    this.approvedCount = 0;
  }
  if (this.capacity !== null && this.approvedCount > this.capacity) {
    return next(
      new Error(
        `Event capacity invariant violated: approvedCount (${this.approvedCount}) exceeds capacity (${this.capacity})`
      )
    );
  }
  next();
});

export default mongoose.model("Event", eventSchema);

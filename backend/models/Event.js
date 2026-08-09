import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, default: "" },
    date: { type: Date },
    capacity: { type: Number, default: null }, // null = unlimited
    club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  },
  { timestamps: true }
);

eventSchema.index({ club: 1, slug: 1 }, { unique: true });

export default mongoose.model("Event", eventSchema);

import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    date: { type: Date },
    capacity: { type: Number, default: null }, // null = unlimited
  },
  { timestamps: true }
);

export default mongoose.model("Event", eventSchema);

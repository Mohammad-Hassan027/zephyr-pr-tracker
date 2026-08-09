import mongoose from "mongoose";

const prMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    passwordHash: { type: String, required: true },
    club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  },
  { timestamps: true }
);

prMemberSchema.index({ club: 1, code: 1 }, { unique: true });

export default mongoose.model("PRMember", prMemberSchema);

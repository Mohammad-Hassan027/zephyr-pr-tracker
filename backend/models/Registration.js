import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    studentPhone: { type: String },
    college: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    regNo: { type: String, unique: true, sparse: true }, // assigned on approval only
    event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    referralCode: { type: String, uppercase: true, trim: true, default: null }, // PRMember.code, null if direct/organic

    // UPI payment proof, hosted on Cloudinary
    paymentScreenshot: { type: String, required: true }, // secure_url
    paymentScreenshotPublicId: { type: String }, // for cleanup on rejection

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: { type: String, default: null }, // PRMember.code that approved/rejected
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true }
);

// Prevent duplicate signup for same event+email
registrationSchema.index({ event: 1, studentEmail: 1 }, { unique: true });

export default mongoose.model("Registration", registrationSchema);

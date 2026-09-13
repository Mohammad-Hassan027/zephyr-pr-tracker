import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema(
  {
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    studentPhone: { type: String },
    normalizedEmail: { type: String, trim: true, lowercase: true, index: true },
    normalizedPhone: { type: String, trim: true, default: "", index: true },
    college: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    utr: { type: String, trim: true, default: "" }, // UPI transaction reference number
    normalizedUtr: { type: String, trim: true, uppercase: true, default: "", index: true },
    regNo: { type: String, unique: true, sparse: true }, // assigned on approval only
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    club: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    referralCode: { type: String, uppercase: true, trim: true, default: null }, // PRMember.code, null if direct/organic
    accessTokenHash: { type: String, select: false, index: true },
    accessTokenIssuedAt: { type: Date, default: null },

    // UPI payment proof, hosted on Cloudinary
    paymentScreenshot: { type: String, required: true }, // secure_url
    paymentScreenshotPublicId: { type: String }, // for cleanup on rejection

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "needs_correction",
        "resubmitted",
        "under_review",
      ],
      default: "pending",
    },
    reviewedBy: { type: String, default: null }, // PRMember.code that approved/rejected
    rejectionReason: { type: String, default: null },
    correctionNote: { type: String, default: null },
    lastCorrectionRequestedAt: { type: Date, default: null },
    resubmittedAt: { type: Date, default: null },
    customFields: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Duplicate and Suspicion Detection Flags
    suspicionFlags: {
      isSuspicious: { type: Boolean, default: false, index: true },
      signals: [
        {
          signal: {
            type: String,
            enum: [
              "SAME_EMAIL_SAME_EVENT",
              "SAME_PHONE_SAME_EVENT",
              "REUSED_TRANSACTION_ID",
              "REUSED_PAYMENT_PROOF",
              "SIMILAR_NAME_MATCHING_CONTACT",
              "HIGH_FREQUENCY_SUBMISSION",
              "OTHER",
            ],
            required: true,
          },
          reason: { type: String, required: true },
          matchingRegistrationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Registration",
            default: null,
          },
          matchingField: { type: String, default: null },
          detectedAt: { type: Date, default: Date.now },
          confidence: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "high",
          },
        },
      ],
      resolution: {
        status: {
          type: String,
          enum: [
            "pending",
            "confirmed_duplicate",
            "marked_legitimate",
            "linked",
            "ignored",
          ],
          default: "pending",
        },
        resolvedBy: { type: String, default: null },
        resolvedAt: { type: Date, default: null },
        notes: { type: String, default: null },
        linkedRegistrationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Registration",
          default: null,
        },
      },
    },

    attendanceStatus: {
      type: String,
      enum: ["present", "absent", "not_marked"],
      default: "not_marked",
    },
    checkedInAt: { type: Date, default: null },
    checkedInBy: { type: String, default: null },
    checkInSource: {
      type: String,
      enum: ["qr_scan", "manual", "override", null],
      default: null,
    },
    checkInNotes: { type: String, default: null },
    history: [
      {
        action: { type: String, required: true },
        status: { type: String, required: true },
        performedBy: { type: String, default: null },
        note: { type: String, default: null },
        changes: { type: mongoose.Schema.Types.Mixed, default: null },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Event-scoped lookup indexes (non-unique to allow non-blocking duplicate detection and flagging)
registrationSchema.index({ event: 1, studentEmail: 1 });
registrationSchema.index({ event: 1, normalizedEmail: 1 });
registrationSchema.index({ event: 1, normalizedPhone: 1 });

// Compound Indexes for Scalable Querying & Concurrency
// 1. Pending queue queries sorted by submission timestamp
registrationSchema.index({ club: 1, status: 1, createdAt: 1 });

// 2. Audit trail queries sorted by review timestamp
registrationSchema.index({ club: 1, status: 1, updatedAt: -1 });

// 3. Referral code analytics and leaderboard aggregations
registrationSchema.index({ club: 1, status: 1, referralCode: 1 });

// 4. Event capacity check and per-event participation statistics
registrationSchema.index({ event: 1, status: 1 });

// 5. Attendance & Check-in indexes
registrationSchema.index({ event: 1, attendanceStatus: 1 });
registrationSchema.index({ club: 1, attendanceStatus: 1 });

// 6. Duplicate transaction ID & suspicion indexes
registrationSchema.index({ club: 1, normalizedUtr: 1, status: 1 });
registrationSchema.index({ normalizedUtr: 1, status: 1 });
registrationSchema.index({ event: 1, "suspicionFlags.isSuspicious": 1 });

export default mongoose.models.Registration || mongoose.model("Registration", registrationSchema);

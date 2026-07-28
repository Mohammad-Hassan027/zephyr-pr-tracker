import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import { nextSequence } from "../models/Counter.js";
import cloudinary, { uploadBuffer } from "../config/cloudinary.js";
import { requireAdmin, requireAdminOrPRMember } from "../utils/auth.js";

const router = Router();

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 submissions per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many registration attempts from this IP. Please try again after 15 minutes.",
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Screenshot must be an image"));
    }
    cb(null, true);
  },
});

function getReviewerCode(auth) {
  return auth.role === "admin" ? "admin" : auth.code;
}

function canReviewRegistration(auth, registration) {
  return auth.role === "admin" || registration.referralCode === auth.code;
}

// POST /api/registrations - public submission: details + referral + event + UPI screenshot.
// Lands as status "pending"; no regNo yet. A PR member or admin must approve it.
router.post("/", registrationLimiter, upload.single("screenshot"), async (req, res) => {
  try {
    const { studentName, studentEmail, studentPhone, college, amount, eventSlug, referralCode } =
      req.body;

    if (!req.file) return res.status(400).json({ error: "UPI screenshot is required" });

    const event = await Event.findOne({ slug: eventSlug });
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (event.capacity) {
      const count = await Registration.countDocuments({ event: event._id, status: "approved" });
      if (count >= event.capacity) {
        return res.status(400).json({ error: "Event is full" });
      }
    }

    let validCode = null;
    if (referralCode) {
      const member = await PRMember.findOne({ code: referralCode.toUpperCase() });
      if (member) validCode = member.code;
    }

    const uploadResult = await uploadBuffer(req.file.buffer);

    const registration = await Registration.create({
      studentName,
      studentEmail,
      studentPhone,
      college,
      amount: amount ? Number(amount) : 0,
      event: event._id,
      referralCode: validCode,
      paymentScreenshot: uploadResult.secure_url,
      paymentScreenshotPublicId: uploadResult.public_id,
      status: "pending",
    });

    res.status(201).json({ id: registration._id, status: registration.status });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "You already registered for this event" });
    }
    res.status(400).json({ error: err.message });
  }
});

// GET /api/registrations/queue/pending - authenticated approval queue.
router.get("/queue/pending", requireAdminOrPRMember, async (req, res) => {
  const filter = { status: "pending" };

  if (req.auth.role === "pr") {
    filter.referralCode = req.auth.code;
  } else if (req.query.code) {
    filter.referralCode = String(req.query.code).toUpperCase();
  }

  const pending = await Registration.find(filter)
    .populate("event", "name slug")
    .sort({ createdAt: 1 });
  res.json(pending);
});

// GET /api/registrations/stats - approved participation count per event
router.get("/stats/summary", requireAdmin, async (_req, res) => {
  const stats = await Registration.aggregate([
    { $match: { status: "approved" } },
    { $group: { _id: "$event", count: { $sum: 1 } } },
    {
      $lookup: {
        from: "events",
        localField: "_id",
        foreignField: "_id",
        as: "event",
      },
    },
    { $unwind: "$event" },
    {
      $project: {
        _id: 0,
        eventId: "$event._id",
        name: "$event.name",
        slug: "$event.slug",
        capacity: "$event.capacity",
        count: 1,
      },
    },
    { $sort: { count: -1 } },
  ]);
  res.json(stats);
});

// GET /api/registrations/leaderboard - approved referral counts per PR member
router.get("/stats/leaderboard", requireAdmin, async (_req, res) => {
  const leaderboard = await Registration.aggregate([
    { $match: { status: "approved", referralCode: { $ne: null } } },
    { $group: { _id: "$referralCode", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const members = await PRMember.find();
  const counts = Object.fromEntries(leaderboard.map((l) => [l._id, l.count]));
  const full = members
    .map((m) => ({ name: m.name, code: m.code, count: counts[m.code] || 0 }))
    .sort((a, b) => b.count - a.count);

  res.json(full);
});

// GET /api/registrations/audit - admin audit trail of reviewed (approved/rejected) registrations
router.get("/audit", requireAdmin, async (_req, res) => {
  const audit = await Registration.find({ status: { $in: ["approved", "rejected"] } })
    .populate("event", "name slug")
    .sort({ updatedAt: -1 });
  res.json(audit);
});

// GET /api/registrations/:id - status check (used by the participant's status page)
router.get("/:id", async (req, res) => {
  const reg = await Registration.findById(req.params.id).populate("event", "name slug date");
  if (!reg) return res.status(404).json({ error: "Not found" });

  res.json({
    status: reg.status,
    rejectionReason: reg.rejectionReason,
    regNo: reg.regNo,
    studentName: reg.studentName,
    studentEmail: reg.studentEmail,
    studentPhone: reg.studentPhone,
    college: reg.college,
    amount: reg.amount,
    createdAt: reg.createdAt,
    event: reg.event,
  });
});

// PATCH /api/registrations/:id/approve - authenticated PR member or admin approval.
router.patch("/:id/approve", requireAdminOrPRMember, async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ error: "Not found" });
    if (reg.status !== "pending") return res.status(400).json({ error: "Already reviewed" });
    if (!canReviewRegistration(req.auth, reg)) {
      return res.status(403).json({ error: "You cannot review this registration" });
    }

    const seq = await nextSequence("regNo");
    reg.regNo = `ZP${String(seq).padStart(4, "0")}`;
    reg.status = "approved";
    reg.reviewedBy = getReviewerCode(req.auth);
    await reg.save();

    res.json({ ok: true, regNo: reg.regNo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/registrations/:id/reject - authenticated PR member or admin rejection.
router.patch("/:id/reject", requireAdminOrPRMember, async (req, res) => {
  try {
    const { reason } = req.body;
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ error: "Not found" });
    if (reg.status !== "pending") return res.status(400).json({ error: "Already reviewed" });
    if (!canReviewRegistration(req.auth, reg)) {
      return res.status(403).json({ error: "You cannot review this registration" });
    }

    reg.status = "rejected";
    reg.reviewedBy = getReviewerCode(req.auth);
    reg.rejectionReason = reason || "Payment could not be verified";
    await reg.save();

    if (reg.paymentScreenshotPublicId) {
      cloudinary.uploader.destroy(reg.paymentScreenshotPublicId).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

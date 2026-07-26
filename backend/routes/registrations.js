import { Router } from "express";
import multer from "multer";
import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import { nextSequence } from "../models/Counter.js";
import cloudinary, { uploadBuffer } from "../config/cloudinary.js";

const router = Router();

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

// POST /api/registrations - public submission: details + referral + event + UPI screenshot.
// Lands as status "pending" — no regNo yet. A PR member (or admin) must approve it.
router.post("/", upload.single("screenshot"), async (req, res) => {
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

// GET /api/registrations/queue/pending?code=XXX - a PR member's own pending approvals.
// Omit `code` (admin use) to see everything pending across all members.
router.get("/queue/pending", async (req, res) => {
  const { code } = req.query;
  const filter = { status: "pending" };
  if (code) filter.referralCode = String(code).toUpperCase();

  const pending = await Registration.find(filter)
    .populate("event", "name slug")
    .sort({ createdAt: 1 });
  res.json(pending);
});

// PATCH /api/registrations/:id/approve - PR member (or admin) approves, assigns regNo
router.patch("/:id/approve", async (req, res) => {
  try {
    const { reviewerCode } = req.body;
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ error: "Not found" });
    if (reg.status !== "pending") return res.status(400).json({ error: "Already reviewed" });

    const seq = await nextSequence("regNo");
    reg.regNo = `ZP${String(seq).padStart(4, "0")}`;
    reg.status = "approved";
    reg.reviewedBy = reviewerCode || "admin";
    await reg.save();

    res.json({ ok: true, regNo: reg.regNo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/registrations/:id/reject
router.patch("/:id/reject", async (req, res) => {
  try {
    const { reviewerCode, reason } = req.body;
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ error: "Not found" });
    if (reg.status !== "pending") return res.status(400).json({ error: "Already reviewed" });

    reg.status = "rejected";
    reg.reviewedBy = reviewerCode || "admin";
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

// GET /api/registrations/stats - approved participation count per event
router.get("/stats/summary", async (_req, res) => {
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
router.get("/stats/leaderboard", async (_req, res) => {
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

export default router;

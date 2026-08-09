import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import multer from "multer";
import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import Club from "../models/Club.js";
import { nextSequence } from "../models/Counter.js";
import cloudinary, { uploadBuffer } from "../config/cloudinary.js";
import { requireClub, requireClubOrPRMember } from "../utils/auth.js";

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
  return auth.role === "club" || auth.role === "admin" ? "admin" : auth.code;
}

function canReviewRegistration(auth, registration) {
  if (auth.clubId && registration.club && !registration.club.equals(auth.clubId)) {
    return false;
  }
  return auth.role === "club" || auth.role === "admin" || registration.referralCode === auth.code;
}

// POST /api/registrations - public submission: details + referral + event + UPI screenshot.
// Copies club from event onto registration doc.
router.post("/", registrationLimiter, upload.single("screenshot"), async (req, res) => {
  try {
    const { studentName, studentEmail, studentPhone, college, amount, eventSlug, clubSlug, referralCode } =
      req.body;

    if (!req.file) return res.status(400).json({ error: "UPI screenshot is required" });

    if (!clubSlug) {
      return res.status(400).json({ error: "Club identifier is required" });
    }

    const club = await Club.findOne({ slug: String(clubSlug).trim().toLowerCase() });
    if (!club) return res.status(404).json({ error: "Club not found" });

    const event = await Event.findOne({ slug: eventSlug, club: club._id });
    if (!event) return res.status(404).json({ error: "Event not found for this club" });

    if (event.capacity) {
      const count = await Registration.countDocuments({ event: event._id, status: "approved" });
      if (count >= event.capacity) {
        return res.status(400).json({ error: "Event is full" });
      }
    }

    let validCode = null;
    if (referralCode) {
      const member = await PRMember.findOne({
        code: referralCode.toUpperCase(),
        club: event.club,
      });
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
      club: event.club,
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

// GET /api/registrations/queue/pending - authenticated approval queue scoped to club.
router.get("/queue/pending", requireClubOrPRMember, async (req, res) => {
  try {
    const filter = { status: "pending" };

    if (req.auth.clubId) {
      filter.club = req.auth.clubId;
    }

    if (req.auth.role === "pr") {
      filter.referralCode = req.auth.code;
    } else if (req.query.code) {
      filter.referralCode = String(req.query.code).toUpperCase();
    }

    if (req.query.event) {
      const evFilter = { slug: String(req.query.event).trim() };
      if (req.auth.clubId) evFilter.club = req.auth.clubId;
      const ev = await Event.findOne(evFilter);
      if (!ev) return res.json([]);
      filter.event = ev._id;
    }

    if (req.query.college) {
      filter.college = { $regex: String(req.query.college).trim(), $options: "i" };
    }

    if (req.query.from || req.query.to) {
      const createdAtFilter = {};
      if (req.query.from) {
        const fromDate = new Date(String(req.query.from).trim());
        if (!isNaN(fromDate.getTime())) {
          createdAtFilter.$gte = fromDate;
        }
      }
      if (req.query.to) {
        const toStr = String(req.query.to).trim();
        let toDate = new Date(toStr);
        if (/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
          toDate = new Date(`${toStr}T23:59:59.999Z`);
        }
        if (!isNaN(toDate.getTime())) {
          createdAtFilter.$lte = toDate;
        }
      }
      if (Object.keys(createdAtFilter).length > 0) {
        filter.createdAt = createdAtFilter;
      }
    }

    const pending = await Registration.find(filter)
      .populate("event", "name slug")
      .sort({ createdAt: 1 });
    res.json(pending);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/registrations/stats/summary - approved participation count per event for club
router.get("/stats/summary", requireClub, async (req, res) => {
  try {
    const clubId = req.auth.clubId;
    const clubObjId = new mongoose.Types.ObjectId(String(clubId));

    const events = await Event.find({ club: clubId }).sort({ date: 1 });
    const approvedCounts = await Registration.aggregate([
      { $match: { status: "approved", club: clubObjId } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);

    const countsMap = Object.fromEntries(
      approvedCounts.map((item) => [String(item._id), item.count])
    );

    const stats = events.map((ev) => ({
      eventId: ev._id,
      name: ev.name,
      slug: ev.slug,
      capacity: ev.capacity,
      count: countsMap[String(ev._id)] || 0,
    }));

    stats.sort((a, b) => b.count - a.count);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/registrations/stats/leaderboard - approved referral counts per PR member for club
router.get("/stats/leaderboard", requireClub, async (req, res) => {
  try {
    const clubId = req.auth.clubId;
    const clubObjId = new mongoose.Types.ObjectId(String(clubId));

    const leaderboard = await Registration.aggregate([
      { $match: { status: "approved", referralCode: { $ne: null }, club: clubObjId } },
      { $group: { _id: "$referralCode", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const members = await PRMember.find({ club: clubId });
    const counts = Object.fromEntries(leaderboard.map((l) => [l._id, l.count]));
    const full = members
      .map((m) => ({ name: m.name, code: m.code, count: counts[m.code] || 0 }))
      .sort((a, b) => b.count - a.count);

    res.json(full);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/registrations/audit - club admin audit trail of reviewed registrations
router.get("/audit", requireClub, async (req, res) => {
  try {
    const clubId = req.auth.clubId;
    const audit = await Registration.find({
      status: { $in: ["approved", "rejected"] },
      club: clubId,
    })
      .populate("event", "name slug")
      .sort({ updatedAt: -1 });
    res.json(audit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/registrations/:id - status check
router.get("/:id", async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/registrations/:id/approve - authenticated PR member or club admin approval.
router.patch("/:id/approve", requireClubOrPRMember, async (req, res) => {
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

// PATCH /api/registrations/:id/reject - authenticated PR member or club admin rejection.
router.patch("/:id/reject", requireClubOrPRMember, async (req, res) => {
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

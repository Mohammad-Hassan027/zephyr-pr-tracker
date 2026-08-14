import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import multer from "multer";
import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import Club from "../models/Club.js";
import { nextSequence } from "../models/Counter.js";
import { withTransaction } from "../utils/transaction.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
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

// PATCH /api/registrations/:id/approve - thread-safe atomic registration approval
router.patch("/:id/approve", requireClubOrPRMember, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (session) => {
      // 1. Fetch the registration document using the transactional session
      const reg = await Registration.findById(id).session(session);

      if (!reg) {
        throw new NotFoundError("Registration not found");
      }

      // 2. Enforce role-based and club authorization
      if (!canReviewRegistration(req.auth, reg)) {
        throw new ForbiddenError("You cannot review this registration");
      }

      // 3. Verify the current status (prevent double approvals / race conditions)
      if (reg.status !== "pending") {
        throw new ConflictError(`Registration has already been reviewed (${reg.status})`);
      }

      // 4. Concurrency-safe event capacity validation
      if (reg.event) {
        const event = await Event.findById(reg.event).session(session);
        if (event && event.capacity) {
          const approvedCount = await Registration.countDocuments({
            event: event._id,
            status: "approved",
          }).session(session);

          if (approvedCount >= event.capacity) {
            throw new ConflictError("Event capacity has already been reached");
          }
        }
      }

      // 5. Atomically increment sequential counter within the same session
      const seq = await nextSequence("regNo", session);
      const regNo = `REG-${String(seq).padStart(4, "0")}`;

      // 6. Update registration document within the transaction
      reg.regNo = regNo;
      reg.status = "approved";
      reg.reviewedBy = getReviewerCode(req.auth);
      await reg.save({ session });

      return {
        id: reg._id,
        regNo: reg.regNo,
        status: reg.status,
        studentName: reg.studentName,
        studentEmail: reg.studentEmail,
        reviewedBy: reg.reviewedBy,
      };
    });

    return res.status(200).json({
      ok: true,
      message: "Registration approved successfully",
      data: result,
      regNo: result.regNo,
    });
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode || err.status).json({
        error: err.message,
        details: err.details || null,
      });
    }

    if (err.code === 11000) {
      return res.status(409).json({
        error: "Registration ID conflict encountered, please retry",
      });
    }

    console.error("[Approve Route Error]:", err);
    return res.status(500).json({
      error: err.message || "Failed to approve registration due to an internal error",
    });
  }
});

// PATCH /api/registrations/:id/reject - authenticated PR member or club admin rejection.
router.patch("/:id/reject", requireClubOrPRMember, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await withTransaction(async (session) => {
      const reg = await Registration.findById(id).session(session);
      if (!reg) throw new NotFoundError("Registration not found");

      if (reg.status !== "pending") {
        throw new ConflictError(`Registration has already been reviewed (${reg.status})`);
      }

      if (!canReviewRegistration(req.auth, reg)) {
        throw new ForbiddenError("You cannot review this registration");
      }

      reg.status = "rejected";
      reg.reviewedBy = getReviewerCode(req.auth);
      reg.rejectionReason = reason || "Payment could not be verified";
      await reg.save({ session });

      return {
        id: reg._id,
        status: reg.status,
        paymentScreenshotPublicId: reg.paymentScreenshotPublicId,
      };
    });

    // Cloudinary cleanup after transaction has committed
    if (result.paymentScreenshotPublicId) {
      cloudinary.uploader.destroy(result.paymentScreenshotPublicId).catch(() => {});
    }

    return res.status(200).json({
      ok: true,
      message: "Registration rejected",
      status: result.status,
    });
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode || err.status).json({
        error: err.message,
        details: err.details || null,
      });
    }

    console.error("[Reject Route Error]:", err);
    return res.status(500).json({
      error: err.message || "Failed to reject registration",
    });
  }
});

export default router;

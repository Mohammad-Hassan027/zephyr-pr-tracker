import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import PRMember from "../models/PRMember.js";
import Club from "../models/Club.js";
import { nextSequence } from "../models/Counter.js";
import { withTransaction } from "../utils/transaction.js";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";
import { statusEmitter } from "../utils/statusEmitter.js";
import cloudinary from "../config/cloudinary.js";
import { requireClub, requireClubOrPRMember } from "../utils/auth.js";

const router = Router();
const CLOUDINARY_UPLOAD_FOLDER = "zephyr-payments";

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 submissions per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many registration attempts from this IP. Please try again after 15 minutes.",
  },
});

const uploadSignatureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many upload attempts from this IP. Please try again shortly.",
  },
});

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidCloudinaryPublicId(value) {
  const publicId = toTrimmedString(value);
  return (
    publicId.length > CLOUDINARY_UPLOAD_FOLDER.length + 1 &&
    publicId.length <= 255 &&
    publicId.startsWith(`${CLOUDINARY_UPLOAD_FOLDER}/`) &&
    /^[A-Za-z0-9/_-]+$/.test(publicId) &&
    !publicId.includes("..") &&
    !publicId.includes("//")
  );
}

function isValidCloudinaryImageUrl(value, publicId) {
  try {
    const url = new URL(value);
    const pathWithoutExtension = url.pathname.replace(/\.[^/.]+$/, "");

    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/image/upload/") &&
      pathWithoutExtension.endsWith(`/${publicId}`)
    );
  } catch (_err) {
    return false;
  }
}

function getReviewerCode(auth) {
  return auth.role === "club" || auth.role === "admin" ? "admin" : auth.code;
}

function canReviewRegistration(auth, registration) {
  if (auth.clubId && registration.club && !registration.club.equals(auth.clubId)) {
    return false;
  }
  return auth.role === "club" || auth.role === "admin" || registration.referralCode === auth.code;
}

// GET /api/registrations/upload-signature - signed direct-upload params for payment screenshots.
router.get("/upload-signature", uploadSignatureLimiter, (_req, res) => {
  try {
    const { api_key: apiKey, api_secret: apiSecret, cloud_name: cloudName } =
      cloudinary.config();

    if (!apiKey || !apiSecret || !cloudName) {
      return res.status(500).json({ error: "Cloudinary upload is not configured" });
    }

    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      folder: CLOUDINARY_UPLOAD_FOLDER,
      timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return res.json({
      timestamp,
      signature,
      api_key: apiKey,
      cloud_name: cloudName,
      folder: CLOUDINARY_UPLOAD_FOLDER,
    });
  } catch (_err) {
    return res.status(500).json({ error: "Failed to generate upload signature" });
  }
});

// POST /api/registrations - public submission with a direct-uploaded payment screenshot.
// Copies club from event onto registration doc.
router.post("/", registrationLimiter, async (req, res) => {
  try {
    const {
      studentName,
      studentEmail,
      studentPhone,
      college,
      amount,
      utr,
      eventSlug,
      clubSlug,
      referralCode,
      paymentScreenshot,
      paymentScreenshotPublicId,
    } = req.body;

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

    const screenshotUrl = toTrimmedString(paymentScreenshot);
    const screenshotPublicId = toTrimmedString(paymentScreenshotPublicId);

    if (!screenshotUrl || !screenshotPublicId) {
      return res.status(400).json({
        error: "Payment screenshot URL and public ID are required",
      });
    }

    if (!isValidCloudinaryPublicId(screenshotPublicId)) {
      return res.status(400).json({ error: "Invalid payment screenshot public ID" });
    }

    if (!isValidCloudinaryImageUrl(screenshotUrl, screenshotPublicId)) {
      return res.status(400).json({ error: "Invalid payment screenshot URL" });
    }

    const registration = await Registration.create({
      studentName,
      studentEmail,
      studentPhone,
      college,
      amount: amount ? Number(amount) : 0,
      utr: toTrimmedString(utr),
      event: event._id,
      club: event.club,
      referralCode: validCode,
      paymentScreenshot: screenshotUrl,
      paymentScreenshotPublicId: screenshotPublicId,
      status: "pending",
    });

    res.status(201).json({ id: registration._id, status: registration.status });
  } catch (err) {
    if (err.code === 11000) {
      try {
        const club = await Club.findOne({ slug: String(req.body.clubSlug || "").trim().toLowerCase() });
        const event = club ? await Event.findOne({ slug: req.body.eventSlug, club: club._id }) : null;
        const existing = event ? await Registration.findOne({
          event: event._id,
          studentEmail: String(req.body.studentEmail || "").trim().toLowerCase(),
        }).select("_id status") : null;

        return res.status(409).json({
          error: "You already registered for this event",
          registrationId: existing?._id || null,
          status: existing?.status || null,
        });
      } catch (_lookupErr) {
        return res.status(409).json({ error: "You already registered for this event" });
      }
    }
    res.status(400).json({ error: err.message });
  }
});

// POST /api/registrations/check-duplicate - check if student already registered
router.post("/check-duplicate", async (req, res) => {
  try {
    const { clubSlug, eventSlug, studentEmail } = req.body;
    if (!clubSlug || !eventSlug || !studentEmail) {
      return res.status(400).json({ error: "clubSlug, eventSlug, and studentEmail are required" });
    }

    const club = await Club.findOne({ slug: String(clubSlug).trim().toLowerCase() });
    if (!club) return res.status(404).json({ error: "Club not found" });

    const event = await Event.findOne({ slug: String(eventSlug).trim(), club: club._id });
    if (!event) return res.status(404).json({ error: "Event not found" });

    const existing = await Registration.findOne({
      event: event._id,
      studentEmail: String(studentEmail).trim().toLowerCase(),
    });

    if (existing) {
      return res.json({
        exists: true,
        registrationId: existing._id,
        status: existing.status,
        regNo: existing.regNo || null,
      });
    }

    return res.json({ exists: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/registrations/lookup - student status lookup by email
router.post("/lookup", async (req, res) => {
  try {
    const { studentEmail, clubSlug } = req.body;
    if (!studentEmail) {
      return res.status(400).json({ error: "Student email is required" });
    }

    const filter = {
      studentEmail: String(studentEmail).trim().toLowerCase(),
    };

    if (clubSlug) {
      const club = await Club.findOne({ slug: String(clubSlug).trim().toLowerCase() });
      if (club) {
        filter.club = club._id;
      }
    }

    const registrations = await Registration.find(filter)
      .populate("event", "name slug date venue fee description")
      .populate("club", "name slug email")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      registrations: registrations.map((r) => ({
        id: r._id,
        regNo: r.regNo || null,
        status: r.status,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        studentPhone: r.studentPhone,
        college: r.college,
        amount: r.amount,
        createdAt: r.createdAt,
        rejectionReason: r.rejectionReason,
        event: r.event,
        club: r.club,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/registrations/queue/pending - paginated approval queue scoped to club.
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
      if (!ev) {
        return res.json({
          items: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        });
      }
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

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [total, pending] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.find(filter)
        .populate("event", "name slug venue fee date")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.json({
      items: pending,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
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

// GET /api/registrations/stats/member - personal referral performance metrics for PR member
router.get("/stats/member", requireClubOrPRMember, async (req, res) => {
  try {
    const code = req.auth.role === "pr" ? req.auth.code : (req.query.code ? String(req.query.code).toUpperCase() : null);
    if (!code) {
      return res.status(400).json({ error: "Referral code required" });
    }

    const filter = { referralCode: code };
    if (req.auth.clubId) {
      filter.club = req.auth.clubId;
    }

    const [totalApproved, totalPending, totalRejected, revenueAgg, referrals] = await Promise.all([
      Registration.countDocuments({ ...filter, status: "approved" }),
      Registration.countDocuments({ ...filter, status: "pending" }),
      Registration.countDocuments({ ...filter, status: "rejected" }),
      Registration.aggregate([
        { $match: { ...filter, status: "approved" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Registration.find(filter)
        .populate("event", "name slug venue fee date")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const totalRevenue = revenueAgg[0]?.total || 0;

    res.json({
      code,
      totalApproved,
      totalPending,
      totalRejected,
      totalRevenue,
      referrals: referrals.map((r) => ({
        id: r._id,
        regNo: r.regNo || null,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        studentPhone: r.studentPhone,
        college: r.college,
        amount: r.amount,
        utr: r.utr || "",
        status: r.status,
        rejectionReason: r.rejectionReason,
        event: r.event,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/registrations/audit - paginated club admin audit trail of reviewed registrations
router.get("/audit", requireClub, async (req, res) => {
  try {
    const clubId = req.auth.clubId;
    const filter = {
      status: { $in: ["approved", "rejected"] },
      club: clubId,
    };

    if (req.query.status && ["approved", "rejected"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.reviewer) {
      filter.reviewedBy = { $regex: String(req.query.reviewer).trim(), $options: "i" };
    }

    if (req.query.from || req.query.to) {
      const updatedAtFilter = {};
      if (req.query.from) {
        const fromDate = new Date(String(req.query.from).trim());
        if (!isNaN(fromDate.getTime())) {
          updatedAtFilter.$gte = fromDate;
        }
      }
      if (req.query.to) {
        const toStr = String(req.query.to).trim();
        let toDate = new Date(toStr);
        if (/^\d{4}-\d{2}-\d{2}$/.test(toStr)) {
          toDate = new Date(`${toStr}T23:59:59.999Z`);
        }
        if (!isNaN(toDate.getTime())) {
          updatedAtFilter.$lte = toDate;
        }
      }
      if (Object.keys(updatedAtFilter).length > 0) {
        filter.updatedAt = updatedAtFilter;
      }
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [total, audit] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.find(filter)
        .populate("event", "name slug venue fee date")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      items: audit,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/registrations/:id/stream - Server-Sent Events (SSE) stream for real-time status updates
router.get("/:id/stream", async (req, res) => {
  const { id } = req.params;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  try {
    const reg = await Registration.findById(id)
      .populate("event", "name slug date venue fee description")
      .populate("club", "name slug email");
    if (!reg) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Registration not found" })}\n\n`);
      return res.end();
    }

    const payload = {
      id: reg._id,
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
      club: reg.club,
    };

    // Send initial status immediately
    res.write(`event: status\ndata: ${JSON.stringify(payload)}\n\n`);

    // If already terminal state, end stream
    if (reg.status !== "pending") {
      return res.end();
    }

    // Subscribe to live status transitions
    const unsubscribe = statusEmitter.subscribe(id, (updatedData) => {
      res.write(`event: status\ndata: ${JSON.stringify(updatedData)}\n\n`);
      if (updatedData.status !== "pending") {
        unsubscribe();
        res.end();
      }
    });

    // 15s keepalive heartbeat
    const heartbeat = setInterval(() => {
      res.write(": keepalive\n\n");
    }, 15000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// GET /api/registrations/:id - status check
router.get("/:id", async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.id)
      .populate("event", "name slug date venue fee description")
      .populate("club", "name slug email");
    if (!reg) return res.status(404).json({ error: "Not found" });

    res.json({
      id: reg._id,
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
      club: reg.club,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/registrations/bulk-approve - batch approve registrations
router.post("/bulk-approve", requireClubOrPRMember, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids must be a non-empty array" });
    }

    const results = [];
    const errors = [];

    await withTransaction(async (session) => {
      for (const id of ids) {
        try {
          const reg = await Registration.findById(id)
            .populate("event", "name slug date")
            .session(session);

          if (!reg) {
            errors.push({ id, error: "Registration not found" });
            continue;
          }

          if (!canReviewRegistration(req.auth, reg)) {
            errors.push({ id, error: "Unauthorized to review this registration" });
            continue;
          }

          if (reg.status !== "pending") {
            errors.push({ id, error: `Already reviewed (${reg.status})` });
            continue;
          }

          if (reg.event) {
            const eventId = reg.event._id || reg.event;
            const event = await Event.findById(eventId).session(session);
            if (event && event.capacity) {
              const approvedCount = await Registration.countDocuments({
                event: event._id,
                status: "approved",
              }).session(session);

              if (approvedCount >= event.capacity) {
                errors.push({ id, error: "Event capacity reached" });
                continue;
              }
            }
          }

          const seq = await nextSequence("regNo", session);
          const regNo = `REG-${String(seq).padStart(4, "0")}`;

          reg.regNo = regNo;
          reg.status = "approved";
          reg.reviewedBy = getReviewerCode(req.auth);
          await reg.save({ session });

          results.push({
            id: reg._id,
            regNo: reg.regNo,
            status: reg.status,
            studentName: reg.studentName,
            studentEmail: reg.studentEmail,
            studentPhone: reg.studentPhone,
            college: reg.college,
            amount: reg.amount,
            createdAt: reg.createdAt,
            event: reg.event,
            reviewedBy: reg.reviewedBy,
          });
        } catch (itemErr) {
          errors.push({ id, error: itemErr.message });
        }
      }
    });

    for (const item of results) {
      statusEmitter.emitStatusUpdate(item.id, item);
    }

    return res.json({
      ok: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (err) {
    console.error("[Bulk Approve Error]:", err);
    return res.status(500).json({ error: err.message || "Bulk approval failed" });
  }
});

// POST /api/registrations/bulk-reject - batch reject registrations
router.post("/bulk-reject", requireClubOrPRMember, async (req, res) => {
  try {
    const { ids, reason } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids must be a non-empty array" });
    }

    const rejectionReason = reason || "Payment could not be verified";
    const results = [];
    const errors = [];
    const publicIdsToClean = [];

    await withTransaction(async (session) => {
      for (const id of ids) {
        try {
          const reg = await Registration.findById(id)
            .populate("event", "name slug date")
            .session(session);

          if (!reg) {
            errors.push({ id, error: "Registration not found" });
            continue;
          }

          if (!canReviewRegistration(req.auth, reg)) {
            errors.push({ id, error: "Unauthorized to review this registration" });
            continue;
          }

          if (reg.status !== "pending") {
            errors.push({ id, error: `Already reviewed (${reg.status})` });
            continue;
          }

          reg.status = "rejected";
          reg.reviewedBy = getReviewerCode(req.auth);
          reg.rejectionReason = rejectionReason;
          await reg.save({ session });

          if (reg.paymentScreenshotPublicId) {
            publicIdsToClean.push(reg.paymentScreenshotPublicId);
          }

          results.push({
            id: reg._id,
            status: reg.status,
            rejectionReason: reg.rejectionReason,
            studentName: reg.studentName,
            studentEmail: reg.studentEmail,
            event: reg.event,
          });
        } catch (itemErr) {
          errors.push({ id, error: itemErr.message });
        }
      }
    });

    for (const pubId of publicIdsToClean) {
      cloudinary.uploader.destroy(pubId).catch(() => {});
    }

    for (const item of results) {
      statusEmitter.emitStatusUpdate(item.id, item);
    }

    return res.json({
      ok: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    });
  } catch (err) {
    console.error("[Bulk Reject Error]:", err);
    return res.status(500).json({ error: err.message || "Bulk rejection failed" });
  }
});

// PATCH /api/registrations/:id/approve - thread-safe atomic registration approval
router.patch("/:id/approve", requireClubOrPRMember, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await withTransaction(async (session) => {
      // 1. Fetch registration using transactional session
      const reg = await Registration.findById(id).populate("event", "name slug date").session(session);

      if (!reg) {
        throw new NotFoundError("Registration not found");
      }

      // 2. Enforce role-based and club authorization
      if (!canReviewRegistration(req.auth, reg)) {
        throw new ForbiddenError("You cannot review this registration");
      }

      // 3. Verify the current status
      if (reg.status !== "pending") {
        throw new ConflictError(`Registration has already been reviewed (${reg.status})`);
      }

      // 4. Concurrency-safe event capacity validation
      if (reg.event) {
        const eventId = reg.event._id || reg.event;
        const event = await Event.findById(eventId).session(session);
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
        studentPhone: reg.studentPhone,
        college: reg.college,
        amount: reg.amount,
        createdAt: reg.createdAt,
        event: reg.event,
        reviewedBy: reg.reviewedBy,
      };
    });

    // Notify real-time SSE stream listeners
    statusEmitter.emitStatusUpdate(id, result);

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
      const reg = await Registration.findById(id).populate("event", "name slug date").session(session);
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
        rejectionReason: reg.rejectionReason,
        studentName: reg.studentName,
        studentEmail: reg.studentEmail,
        event: reg.event,
        paymentScreenshotPublicId: reg.paymentScreenshotPublicId,
      };
    });

    // Cloudinary cleanup after transaction has committed
    if (result.paymentScreenshotPublicId) {
      cloudinary.uploader.destroy(result.paymentScreenshotPublicId).catch(() => {});
    }

    // Notify real-time SSE stream listeners
    statusEmitter.emitStatusUpdate(id, result);

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

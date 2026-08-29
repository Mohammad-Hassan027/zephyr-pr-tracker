import { Router } from "express";
import bcrypt from "bcryptjs";
import Club from "../models/Club.js";
import {
  createSessionToken,
  isValidPlatformAdminPassword,
  requireClub,
  requirePlatformAdmin,
} from "../utils/auth.js";
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../utils/errors.js";

const router = Router();

// POST /api/clubs/signup
router.post("/signup", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const slug = String(req.body.slug || "").trim().toLowerCase();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !slug || !email || !password) {
      throw new BadRequestError("All fields are required (name, slug, email, password)");
    }

    const existingSlug = await Club.findOne({ slug });
    if (existingSlug) {
      throw new ConflictError("A club with this slug already exists");
    }

    const existingEmail = await Club.findOne({ email });
    if (existingEmail) {
      throw new ConflictError("A club with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const club = await Club.create({
      name,
      slug,
      email,
      passwordHash,
      status: "pending",
    });

    res.status(201).json({
      message: "Your club registration is pending approval.",
      club: { id: club._id, name: club.name, slug: club.slug, email: club.email, status: club.status },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/clubs/login
router.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      throw new BadRequestError("Email and password are required");
    }

    const club = await Club.findOne({ email });
    if (!club) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const validPassword = await bcrypt.compare(password, club.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (club.status === "pending") {
      throw new ForbiddenError("Your club is awaiting approval");
    }
    if (club.status === "rejected") {
      throw new ForbiddenError("Your club application was rejected");
    }
    if (club.status !== "approved") {
      throw new ForbiddenError("Your club account is inactive");
    }

    const token = createSessionToken({ role: "club", clubId: club._id, clubSlug: club.slug });

    res.json({
      token,
      id: club._id,
      slug: club.slug,
      name: club.name,
      email: club.email,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/clubs/platform/login
router.post("/platform/login", (req, res, next) => {
  try {
    const { password } = req.body;
    if (!isValidPlatformAdminPassword(password)) {
      throw new UnauthorizedError("Invalid platform admin password");
    }

    const token = createSessionToken({ role: "platform_admin" });
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// GET /api/clubs/pending
router.get("/pending", requirePlatformAdmin, async (_req, res, next) => {
  try {
    const pendingClubs = await Club.find({ status: "pending" })
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(pendingClubs);
  } catch (err) {
    next(err);
  }
});

// GET /api/clubs/platform/all
router.get("/platform/all", requirePlatformAdmin, async (req, res, next) => {
  try {
    const filter = {};
    const status = req.query.status ? String(req.query.status).trim().toLowerCase() : "all";
    if (status !== "all" && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    if (req.query.q) {
      const q = String(req.query.q).trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { slug: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [total, clubs] = await Promise.all([
      Club.countDocuments(filter),
      Club.find(filter)
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      items: clubs,
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
    next(err);
  }
});

// PATCH /api/clubs/:id/approve
router.patch("/:id/approve", requirePlatformAdmin, async (req, res, next) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) throw new NotFoundError("Club not found");

    club.status = "approved";
    await club.save();

    res.json({ ok: true, id: club._id, status: club.status });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clubs/:id/reject
router.patch("/:id/reject", requirePlatformAdmin, async (req, res, next) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) throw new NotFoundError("Club not found");

    club.status = "rejected";
    await club.save();

    res.json({ ok: true, id: club._id, status: club.status });
  } catch (err) {
    next(err);
  }
});

// GET /api/clubs/me
router.get("/me", requireClub, async (req, res, next) => {
  try {
    const club = await Club.findById(req.auth.clubId).select("-passwordHash");
    if (!club) throw new NotFoundError("Club not found");
    res.json(club);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/clubs/me
router.patch("/me", requireClub, async (req, res, next) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const club = await Club.findById(req.auth.clubId);
    if (!club) throw new NotFoundError("Club not found");

    if (name) club.name = name;
    if (newPassword) {
      if (!currentPassword) throw new BadRequestError("Current password required");
      const isMatch = await bcrypt.compare(currentPassword, club.passwordHash);
      if (!isMatch) throw new UnauthorizedError("Incorrect current password");
      club.passwordHash = await bcrypt.hash(newPassword, 10);
    }
    await club.save();
    res.json({ ok: true, message: "Profile updated successfully" });
  } catch (err) {
    next(err);
  }
});

// GET /api/clubs
router.get("/", async (_req, res, next) => {
  try {
    const clubs = await Club.find({ status: "approved" })
      .select("name slug")
      .sort({ name: 1 });
    res.json(clubs);
  } catch (err) {
    next(err);
  }
});

// GET /api/clubs/public/:slug
router.get("/public/:slug", async (req, res, next) => {
  try {
    const slug = String(req.params.slug).trim().toLowerCase();
    const club = await Club.findOne({ slug, status: "approved" }).select("name slug");
    if (!club) throw new NotFoundError("Club not found");
    res.json(club);
  } catch (err) {
    next(err);
  }
});

export default router;

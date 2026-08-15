import { Router } from "express";
import bcrypt from "bcryptjs";
import Club from "../models/Club.js";
import {
  createSessionToken,
  isValidPlatformAdminPassword,
  requireClub,
  requirePlatformAdmin,
} from "../utils/auth.js";

const router = Router();

// POST /api/clubs/signup (name, slug, email, password → hash + create as pending)
router.post("/signup", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const slug = String(req.body.slug || "").trim().toLowerCase();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !slug || !email || !password) {
      return res.status(400).json({ error: "All fields are required (name, slug, email, password)" });
    }

    const existingSlug = await Club.findOne({ slug });
    if (existingSlug) {
      return res.status(400).json({ error: "A club with this slug already exists" });
    }

    const existingEmail = await Club.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ error: "A club with this email already exists" });
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
    res.status(400).json({ error: err.message });
  }
});

// POST /api/clubs/login (email, password → verify status === approved, return token & club info)
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const club = await Club.findOne({ email });
    if (!club) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const validPassword = await bcrypt.compare(password, club.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (club.status === "pending") {
      return res.status(403).json({ error: "Your club is awaiting approval" });
    }
    if (club.status === "rejected") {
      return res.status(403).json({ error: "Your club application was rejected" });
    }
    if (club.status !== "approved") {
      return res.status(403).json({ error: "Your club account is inactive" });
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clubs/platform/login - platform admin password login
router.post("/platform/login", (req, res) => {
  try {
    const { password } = req.body;
    if (!isValidPlatformAdminPassword(password)) {
      return res.status(401).json({ error: "Invalid platform admin password" });
    }

    const token = createSessionToken({ role: "platform_admin" });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clubs/pending - list pending clubs for platform admin approval
router.get("/pending", requirePlatformAdmin, async (_req, res) => {
  try {
    const pendingClubs = await Club.find({ status: "pending" })
      .select("-passwordHash")
      .sort({ createdAt: -1 });
    res.json(pendingClubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clubs/:id/approve - approve a pending club application
router.patch("/:id/approve", requirePlatformAdmin, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ error: "Club not found" });

    club.status = "approved";
    await club.save();

    res.json({ ok: true, id: club._id, status: club.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/clubs/:id/reject - reject a pending club application
router.patch("/:id/reject", requirePlatformAdmin, async (req, res) => {
  try {
    const club = await Club.findById(req.params.id);
    if (!club) return res.status(404).json({ error: "Club not found" });

    club.status = "rejected";
    await club.save();

    res.json({ ok: true, id: club._id, status: club.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/clubs/me - get current club profile
router.get("/me", requireClub, async (req, res) => {
  try {
    const club = await Club.findById(req.auth.clubId).select("-passwordHash");
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clubs - list approved clubs (public directory)
router.get("/", async (_req, res) => {
  try {
    const clubs = await Club.find({ status: "approved" })
      .select("name slug")
      .sort({ name: 1 });
    res.json(clubs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clubs/public/:slug - public club details (name, slug) for registration page
router.get("/public/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug).trim().toLowerCase();
    const club = await Club.findOne({ slug, status: "approved" }).select("name slug");
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

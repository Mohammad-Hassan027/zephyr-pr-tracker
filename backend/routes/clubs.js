import { Router } from "express";
import bcrypt from "bcryptjs";
import Club from "../models/Club.js";
import { createSessionToken, requireClub } from "../utils/auth.js";

const router = Router();

// POST /api/clubs/signup (name, slug, email, password → hash + create, return token & club info)
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
    const club = await Club.create({ name, slug, email, passwordHash });

    const token = createSessionToken({ role: "club", clubId: club._id, clubSlug: club.slug });

    res.status(201).json({
      token,
      club: { id: club._id, name: club.name, slug: club.slug, email: club.email },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/clubs/login (email, password → verify, return token & club id/slug)
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

// GET /api/clubs/public/:slug - public club details (name, slug) for registration page
router.get("/public/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug).trim().toLowerCase();
    const club = await Club.findOne({ slug }).select("name slug");
    if (!club) return res.status(404).json({ error: "Club not found" });
    res.json(club);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

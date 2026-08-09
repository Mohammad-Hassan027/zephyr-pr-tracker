import { Router } from "express";
import bcrypt from "bcryptjs";
import PRMember from "../models/PRMember.js";
import Club from "../models/Club.js";
import { createSessionToken, requireClub, verifySessionToken } from "../utils/auth.js";

const router = Router();

// GET /api/members - list PR members for club (no password hashes)
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.club) {
      const clubSlug = String(req.query.club).trim().toLowerCase();
      const club = await Club.findOne({ slug: clubSlug });
      if (!club) return res.json([]);
      filter.club = club._id;
    } else {
      const authHeader = req.get("authorization");
      if (authHeader) {
        const token = authHeader.split(" ")[1];
        try {
          const session = verifySessionToken(token);
          if (session.clubId) {
            filter.club = session.clubId;
          }
        } catch (_e) {
          return res.status(401).json({ error: "Authentication required" });
        }
      } else {
        return res.status(401).json({ error: "Authentication required" });
      }
    }

    const members = await PRMember.find(filter).select("-passwordHash").sort({ name: 1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/members - add a PR member for the authenticated club
router.post("/", requireClub, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    let code = String(req.body.code || "").trim().toUpperCase();
    let password = String(req.body.password || "").trim();
    const clubId = req.auth.clubId;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!clubId) {
      return res.status(403).json({ error: "Club association required" });
    }

    if (!code) {
      code = `${name.split(" ")[0].toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    }
    if (!password) {
      password = String(Math.floor(100000 + Math.random() * 900000));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const member = await PRMember.create({ name, code, passwordHash, club: clubId });

    res.status(201).json({ name: member.name, code: member.code, pin: password });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "A PR member with this code already exists in your club" });
    }
    res.status(400).json({ error: err.message });
  }
});

// POST /api/members/login - PR member login with code + PIN
router.post("/login", async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const password = String(req.body.password || "");

    const member = await PRMember.findOne({ code });
    if (!member) return res.status(401).json({ error: "Invalid code or PIN" });

    const ok = await bcrypt.compare(password, member.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid code or PIN" });

    const token = createSessionToken({ role: "pr", code: member.code, clubId: member.club });
    res.json({ name: member.name, code: member.code, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

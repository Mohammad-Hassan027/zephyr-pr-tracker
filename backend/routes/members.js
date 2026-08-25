import { Router } from "express";
import bcrypt from "bcryptjs";
import PRMember from "../models/PRMember.js";
import Club from "../models/Club.js";
import { createSessionToken, requireClub, requireClubOrPRMember } from "../utils/auth.js";
import { optionalAuthenticate } from "../middleware/authenticate.js";

const router = Router();

// GET /api/members - list PR members for club (no password hashes)
router.get("/", optionalAuthenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.query.club) {
      const clubSlug = String(req.query.club).trim().toLowerCase();
      const club = await Club.findOne({ slug: clubSlug });
      if (!club) return res.json([]);
      filter.club = club._id;
    } else if (req.auth?.clubId) {
      filter.club = req.auth.clubId;
    } else {
      return res.status(401).json({ error: "Authentication required" });
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

// PUT /api/members/:id - edit member name or code (club admin required)
router.put("/:id", requireClub, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const member = await PRMember.findOne({ _id: id, club: req.auth.clubId });
    if (!member) return res.status(404).json({ error: "Member not found" });

    if (name) member.name = String(name).trim();
    if (code) member.code = String(code).trim().toUpperCase();

    await member.save();
    res.json({ _id: member._id, name: member.name, code: member.code });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "A PR member with this code already exists in your club" });
    }
    res.status(400).json({ error: err.message });
  }
});

// POST /api/members/:id/reset-pin - generate new PIN for member (club admin required)
router.post("/:id/reset-pin", requireClub, async (req, res) => {
  try {
    const { id } = req.params;
    const member = await PRMember.findOne({ _id: id, club: req.auth.clubId });
    if (!member) return res.status(404).json({ error: "Member not found" });

    const newPin = String(Math.floor(100000 + Math.random() * 900000));
    member.passwordHash = await bcrypt.hash(newPin, 10);
    await member.save();

    res.json({ ok: true, name: member.name, code: member.code, pin: newPin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/members/:id - delete member (club admin required)
router.delete("/:id", requireClub, async (req, res) => {
  try {
    const { id } = req.params;
    const member = await PRMember.findOne({ _id: id, club: req.auth.clubId });
    if (!member) return res.status(404).json({ error: "Member not found" });

    await PRMember.deleteOne({ _id: id, club: req.auth.clubId });
    res.json({ ok: true, message: "Member removed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/members/change-pin - PR member self-service change PIN
router.post("/change-pin", requireClubOrPRMember, async (req, res) => {
  try {
    const { oldPin, newPin } = req.body;
    if (!newPin || String(newPin).length < 4) {
      return res.status(400).json({ error: "New PIN must be at least 4 digits" });
    }

    if (req.auth.role !== "pr") {
      return res.status(400).json({ error: "Only PR members can use this endpoint" });
    }

    const member = await PRMember.findOne({ code: req.auth.code, club: req.auth.clubId });
    if (!member) return res.status(404).json({ error: "Member not found" });

    if (oldPin) {
      const ok = await bcrypt.compare(String(oldPin), member.passwordHash);
      if (!ok) return res.status(400).json({ error: "Current PIN is incorrect" });
    }

    member.passwordHash = await bcrypt.hash(String(newPin).trim(), 10);
    await member.save();

    res.json({ ok: true, message: "PIN updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

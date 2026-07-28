import { Router } from "express";
import bcrypt from "bcryptjs";
import PRMember from "../models/PRMember.js";
import { createSessionToken, requireAdmin } from "../utils/auth.js";

const router = Router();

// GET /api/members - list PR members (admin only, no password hashes)
router.get("/", requireAdmin, async (_req, res) => {
  const members = await PRMember.find().select("-passwordHash").sort({ name: 1 });
  res.json(members);
});

// POST /api/members - add a PR member. Auto-generates code + PIN if not given.
// Returns the plaintext PIN once, so the admin can hand it to the PR member.
router.post("/", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    let code = String(req.body.code || "").trim().toUpperCase();
    let password = String(req.body.password || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    if (!code) {
      code = `${name.split(" ")[0].toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
    }
    if (!password) {
      password = String(Math.floor(100000 + Math.random() * 900000));
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const member = await PRMember.create({ name, code, passwordHash });

    res.status(201).json({ name: member.name, code: member.code, pin: password });
  } catch (err) {
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

    const token = createSessionToken({ role: "pr", code: member.code });
    res.json({ name: member.name, code: member.code, token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

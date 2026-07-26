import { Router } from "express";
import bcrypt from "bcryptjs";
import PRMember from "../models/PRMember.js";

const router = Router();

// GET /api/members - list PR members (no password hashes)
router.get("/", async (_req, res) => {
  const members = await PRMember.find().select("-passwordHash").sort({ name: 1 });
  res.json(members);
});

// POST /api/members - add a PR member. Auto-generates code + PIN if not given.
// Returns the plaintext PIN once, so the admin can hand it to the PR member (it is never stored in plaintext).
router.post("/", async (req, res) => {
  try {
    const { name } = req.body;
    let { code, password } = req.body;

    if (!code) {
      code = name.trim().split(" ")[0].toUpperCase() + Math.floor(100 + Math.random() * 900);
    }
    if (!password) {
      password = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit PIN
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
    const { code, password } = req.body;
    const member = await PRMember.findOne({ code: (code || "").toUpperCase() });
    if (!member) return res.status(401).json({ error: "Invalid code or PIN" });

    const ok = await bcrypt.compare(password || "", member.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid code or PIN" });

    res.json({ name: member.name, code: member.code });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

import { Router } from "express";
import { createSessionToken, isValidAdminPassword } from "../utils/auth.js";

const router = Router();

router.post("/admin/login", (req, res) => {
  try {
    const { password } = req.body;
    if (!isValidAdminPassword(password)) {
      return res.status(401).json({ error: "Wrong password" });
    }

    res.json({ token: createSessionToken({ role: "admin" }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

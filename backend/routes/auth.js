import { Router } from "express";

const router = Router();

// Legacy admin login endpoint replaced by multi-tenant club login
router.post("/admin/login", (_req, res) => {
  return res.status(410).json({
    error: "Single admin password login is deprecated. Please use club login at /api/clubs/login",
  });
});

export default router;

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { registrationLimiter } from "../middleware/security.js";
import { requireClub, requireClubOrPRMember } from "../utils/auth.js";

// Controllers
import { getUploadSignature } from "../controllers/registration-upload.controller.js";
import {
  createRegistration,
  checkDuplicate,
  lookupRegistrations,
  getRegistrationById,
  streamRegistrationStatus,
} from "../controllers/registration.controller.js";
import {
  approveRegistration,
  rejectRegistration,
  bulkApprove,
  bulkReject,
} from "../controllers/registration-review.controller.js";
import {
  getPendingQueue,
  getStatsSummary,
  getLeaderboard,
  getMemberStats,
  getAuditLog,
} from "../controllers/registration-stats.controller.js";

const router = Router();

const uploadSignatureLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many upload attempts from this IP. Please try again shortly.",
  },
});

// Upload Signature
router.get("/upload-signature", uploadSignatureLimiter, getUploadSignature);

// Public Registration Submissions & Lookups
router.post("/", registrationLimiter, createRegistration);
router.post("/check-duplicate", checkDuplicate);
router.post("/lookup", lookupRegistrations);

// Admin & PR Member Statistics, Queues, Audit
router.get("/queue/pending", requireClubOrPRMember, getPendingQueue);
router.get("/stats/summary", requireClub, getStatsSummary);
router.get("/stats/leaderboard", requireClub, getLeaderboard);
router.get("/stats/member", requireClubOrPRMember, getMemberStats);
router.get("/audit", requireClub, getAuditLog);

// Single Registration Status Tracking & Streaming
router.get("/:id/stream", streamRegistrationStatus);
router.get("/:id", getRegistrationById);

// Bulk Review Operations
router.post("/bulk-approve", requireClubOrPRMember, bulkApprove);
router.post("/bulk-reject", requireClubOrPRMember, bulkReject);

// Individual Review Operations
router.patch("/:id/approve", requireClubOrPRMember, approveRegistration);
router.patch("/:id/reject", requireClubOrPRMember, rejectRegistration);

export default router;

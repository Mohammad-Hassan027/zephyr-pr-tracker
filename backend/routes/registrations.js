import { Router } from "express";
import rateLimit from "express-rate-limit";
import { registrationLimiter } from "../middleware/security.js";
import { requireClub, requireClubOrPRMember } from "../utils/auth.js";

// Controllers
import { getUploadSignature } from "../controllers/registration-upload.controller.js";
import {
  createRegistration,
  resubmitRegistration,
  checkDuplicate,
  lookupRegistrations,
  getRegistrationById,
  streamRegistrationStatus,
} from "../controllers/registration.controller.js";
import {
  approveRegistration,
  rejectRegistration,
  requestCorrection,
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
import {
  checkCapacityConsistency,
  reconcileCapacityCounters,
} from "../controllers/registration-capacity.controller.js";

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

// Public Registration Submissions, Lookups & Resubmissions
router.post("/", registrationLimiter, createRegistration);
router.post("/check-duplicate", checkDuplicate);
router.post("/lookup", lookupRegistrations);
router.post("/:id/resubmit", resubmitRegistration);

// Admin & PR Member Statistics, Queues, Audit
router.get("/queue/pending", requireClubOrPRMember, getPendingQueue);
router.get("/stats/summary", requireClub, getStatsSummary);
router.get("/stats/leaderboard", requireClub, getLeaderboard);
router.get("/stats/member", requireClubOrPRMember, getMemberStats);
router.get("/audit", requireClub, getAuditLog);

// Admin Capacity Monitoring & Counter Reconciliation
router.get("/capacity/check", requireClub, checkCapacityConsistency);
router.post("/capacity/reconcile", requireClub, reconcileCapacityCounters);

// Single Registration Status Tracking & Streaming
router.get("/:id/stream", streamRegistrationStatus);
router.get("/:id", getRegistrationById);

// Bulk Review Operations
router.post("/bulk-approve", requireClubOrPRMember, bulkApprove);
router.post("/bulk-reject", requireClubOrPRMember, bulkReject);

// Individual Review Operations
router.patch("/:id/approve", requireClubOrPRMember, approveRegistration);
router.patch("/:id/reject", requireClubOrPRMember, rejectRegistration);
router.patch("/:id/request-correction", requireClubOrPRMember, requestCorrection);

export default router;

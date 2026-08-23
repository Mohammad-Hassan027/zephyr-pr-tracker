import registrationReviewService from "../services/registrations/registration-review.service.js";
import { AppError } from "../utils/errors.js";

export async function approveRegistration(req, res) {
  try {
    const result = await registrationReviewService.approveRegistration({
      id: req.params.id,
      auth: req.auth,
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode || err.status).json({
        error: err.message,
        details: err.details || null,
      });
    }

    if (err.code === 11000) {
      return res.status(409).json({
        error: "Registration ID conflict encountered, please retry",
      });
    }

    console.error("[Approve Controller Error]:", err);
    return res.status(500).json({
      error: err.message || "Failed to approve registration due to an internal error",
    });
  }
}

export async function rejectRegistration(req, res) {
  try {
    const result = await registrationReviewService.rejectRegistration({
      id: req.params.id,
      reason: req.body?.reason,
      auth: req.auth,
    });
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode || err.status).json({
        error: err.message,
        details: err.details || null,
      });
    }

    console.error("[Reject Controller Error]:", err);
    return res.status(500).json({
      error: err.message || "Failed to reject registration",
    });
  }
}

export async function bulkApprove(req, res) {
  try {
    const result = await registrationReviewService.bulkApproveRegistrations({
      ids: req.body?.ids,
      auth: req.auth,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error("[Bulk Approve Controller Error]:", err);
    return res.status(500).json({ error: err.message || "Bulk approval failed" });
  }
}

export async function bulkReject(req, res) {
  try {
    const result = await registrationReviewService.bulkRejectRegistrations({
      ids: req.body?.ids,
      reason: req.body?.reason,
      auth: req.auth,
    });
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }
    console.error("[Bulk Reject Controller Error]:", err);
    return res.status(500).json({ error: err.message || "Bulk rejection failed" });
  }
}

export default {
  approveRegistration,
  rejectRegistration,
  bulkApprove,
  bulkReject,
};

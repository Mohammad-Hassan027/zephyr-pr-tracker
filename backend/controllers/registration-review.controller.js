import registrationReviewService from "../services/registrations/registration-review.service.js";

export async function approveRegistration(req, res, next) {
  try {
    const result = await registrationReviewService.approveRegistration({
      id: req.params.id,
      auth: req.auth,
    });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function rejectRegistration(req, res, next) {
  try {
    const result = await registrationReviewService.rejectRegistration({
      id: req.params.id,
      reason: req.body?.reason,
      auth: req.auth,
    });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function bulkApprove(req, res, next) {
  try {
    const result = await registrationReviewService.bulkApproveRegistrations({
      ids: req.body?.ids,
      auth: req.auth,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function bulkReject(req, res, next) {
  try {
    const result = await registrationReviewService.bulkRejectRegistrations({
      ids: req.body?.ids,
      reason: req.body?.reason,
      auth: req.auth,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default {
  approveRegistration,
  rejectRegistration,
  bulkApprove,
  bulkReject,
};

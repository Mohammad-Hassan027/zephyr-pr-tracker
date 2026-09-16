import registrationService from "../services/registrations/registration.service.js";

export async function createRegistration(req, res, next) {
  try {
    const result = await registrationService.createRegistration(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode === 409 || err.code === 11000) {
      return res.status(409).json({
        error: err.message || "You already registered for this event",
        code: err.code === 11000 ? "CONFLICT_ERROR" : (err.code || "CONFLICT_ERROR"),
        registrationId: err.details?.registrationId || null,
        status: err.details?.status || null,
      });
    }
    return next(err);
  }
}

export async function resubmitRegistration(req, res, next) {
  try {
    const result = await registrationService.resubmitRegistration(
      req.params.id,
      req.body,
      req.get("x-registration-token"),
    );
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

export async function checkDuplicate(req, res, next) {
  try {
    const result = await registrationService.checkDuplicate(req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function lookupRegistrations(req, res, next) {
  try {
    const result = await registrationService.lookupRegistrations({
      ...req.body,
      accessToken: req.get("x-registration-token"),
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getRegistrationById(req, res, next) {
  try {
    const token = req.get("x-registration-token") || req.query.token;
    const result = await registrationService.getRegistrationById(
      req.params.id,
      token,
    );
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function streamRegistrationStatus(req, res, next) {
  try {
    const token = req.get("x-registration-token") || req.query.token;
    return await registrationService.streamRegistrationStatus(
      req.params.id,
      req,
      res,
      token,
    );
  } catch (err) {
    return next(err);
  }
}

export default {
  createRegistration,
  resubmitRegistration,
  checkDuplicate,
  lookupRegistrations,
  getRegistrationById,
  streamRegistrationStatus,
};

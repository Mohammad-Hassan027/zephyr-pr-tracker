import registrationService from "../services/registrations/registration.service.js";

export async function createRegistration(req, res, next) {
  try {
    const result = await registrationService.createRegistration(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode === 409 || err.code === 11000) {
      return res.status(409).json({
        error: err.message || "You already registered for this event",
        code: "CONFLICT_ERROR",
        registrationId: err.details?.registrationId || null,
        status: err.details?.status || null,
      });
    }
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
    const result = await registrationService.lookupRegistrations(req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getRegistrationById(req, res, next) {
  try {
    const result = await registrationService.getRegistrationById(req.params.id);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function streamRegistrationStatus(req, res, next) {
  try {
    return await registrationService.streamRegistrationStatus(req.params.id, req, res);
  } catch (err) {
    return next(err);
  }
}

export default {
  createRegistration,
  checkDuplicate,
  lookupRegistrations,
  getRegistrationById,
  streamRegistrationStatus,
};

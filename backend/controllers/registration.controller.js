import registrationService from "../services/registrations/registration.service.js";
import { AppError } from "../utils/errors.js";

export async function createRegistration(req, res) {
  try {
    const result = await registrationService.createRegistration(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode === 409 || err.code === 11000) {
      return res.status(409).json({
        error: err.message || "You already registered for this event",
        registrationId: err.details?.registrationId || null,
        status: err.details?.status || null,
      });
    }

    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    return res.status(400).json({ error: err.message });
  }
}

export async function checkDuplicate(req, res) {
  try {
    const result = await registrationService.checkDuplicate(req.body);
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

export async function lookupRegistrations(req, res) {
  try {
    const result = await registrationService.lookupRegistrations(req.body);
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

export async function getRegistrationById(req, res) {
  try {
    const result = await registrationService.getRegistrationById(req.params.id);
    return res.json(result);
  } catch (err) {
    if (err instanceof AppError || err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}

export async function streamRegistrationStatus(req, res) {
  return registrationService.streamRegistrationStatus(req.params.id, req, res);
}

export default {
  createRegistration,
  checkDuplicate,
  lookupRegistrations,
  getRegistrationById,
  streamRegistrationStatus,
};

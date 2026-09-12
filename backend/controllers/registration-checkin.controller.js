import checkInService from "../services/registrations/check-in.service.js";

/**
 * Public/Attendee Entry Pass Generation & Retrieval
 */
export async function getEntryPass(req, res, next) {
  try {
    const { id } = req.params;
    const accessToken = req.headers["x-registration-access-token"] || req.query.token || null;
    const result = await checkInService.getEntryPassForRegistration(id, accessToken);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

/**
 * Gate Staff Check-in Token/Registration Verification & Preview
 */
export async function verifyCheckIn(req, res, next) {
  try {
    const { token, registrationId, regNo, eventSlug } = req.body;
    const result = await checkInService.verifyCheckIn({
      token,
      registrationId,
      regNo,
      eventSlug,
      auth: req.auth,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

/**
 * Atomic Check-in Confirmation
 */
export async function confirmCheckIn(req, res, next) {
  try {
    const {
      token,
      registrationId,
      regNo,
      eventSlug,
      overrideDuplicate,
      source,
      notes,
    } = req.body;

    const result = await checkInService.confirmCheckIn({
      token,
      registrationId,
      regNo,
      eventSlug,
      overrideDuplicate: Boolean(overrideDuplicate),
      source: source || "qr_scan",
      notes: typeof notes === "string" ? notes.trim() : "",
      auth: req.auth,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

/**
 * Search attendees for manual check-in fallback
 */
export async function lookupAttendees(req, res, next) {
  try {
    const { search, event, limit } = req.query;
    const result = await checkInService.lookupAttendees({
      search,
      eventSlug: event,
      auth: req.auth,
      limit,
    });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export default {
  getEntryPass,
  verifyCheckIn,
  confirmCheckIn,
  lookupAttendees,
};
import registrationRepository from "../../repositories/registration.repository.js";
import { issueEntryPassToken, verifyEntryPassToken, generatePassQrCodeDataUrl } from "./entry-pass.service.js";
import { canReviewRegistration, getReviewerCode } from "../../policies/registration.policy.js";
import { withTransaction } from "../../utils/transaction.js";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { statusEmitter } from "../../utils/statusEmitter.js";
import { isValidRegistrationAccessToken } from "../../utils/registration-access.js";

/**
 * Check-in & Entry Pass Domain Service
 */
export const checkInService = {
  /**
   * Retrieves or generates a secure entry pass for an approved registration
   * @param {string} registrationId
   * @param {string} [accessToken]
   * @returns {Promise<Object>}
   */
  async getEntryPassForRegistration(registrationId, accessToken = null) {
    if (!registrationId) {
      throw new AppError("Registration ID is required", 400);
    }

    const reg = await registrationRepository.findRegistrationById(registrationId, {
      selectAccessToken: Boolean(accessToken),
      populate: true,
    });

    if (!reg) {
      throw new NotFoundError("Registration not found");
    }

    if (accessToken && reg.accessTokenHash) {
      if (!isValidRegistrationAccessToken(accessToken, reg.accessTokenHash)) {
        throw new NotFoundError("Registration not found");
      }
    }

    if (reg.status !== "approved") {
      throw new AppError(
        `Entry pass is only available for approved registrations (current status: ${reg.status})`,
        400
      );
    }

    const token = issueEntryPassToken({
      registration: reg,
      event: reg.event,
      club: reg.club,
    });

    const qrCodeDataUrl = await generatePassQrCodeDataUrl(token, { width: 320 });

    return {
      ok: true,
      token,
      qrCodeDataUrl,
      pass: {
        id: String(reg._id),
        regNo: reg.regNo || "CONFIRMED",
        studentName: reg.studentName,
        studentEmail: reg.studentEmail,
        college: reg.college || "",
        amount: reg.amount,
        status: reg.status,
        attendanceStatus: reg.attendanceStatus || "not_marked",
        checkedInAt: reg.checkedInAt || null,
        checkedInBy: reg.checkedInBy || null,
        event: {
          id: String(reg.event?._id || reg.event),
          name: reg.event?.name || "Event",
          slug: reg.event?.slug || "",
          date: reg.event?.date || null,
          venue: reg.event?.venue || "",
        },
        club: {
          id: String(reg.club?._id || reg.club),
          name: reg.club?.name || "Club",
          slug: reg.club?.slug || "",
        },
      },
    };
  },

  /**
   * Verifies an entry pass token or identifier for gate check-in preview
   * @param {Object} params
   * @param {string} [params.token] - Signed QR entry pass token
   * @param {string} [params.registrationId] - Optional fallback ID
   * @param {string} [params.regNo] - Optional fallback Reg No
   * @param {string} [params.eventSlug] - Optional event filter
   * @param {Object} params.auth - Authenticated reviewer/admin
   * @returns {Promise<Object>}
   */
  async verifyCheckIn({ token, registrationId, regNo, eventSlug, auth }) {
    let lookupRegId = registrationId || null;
    let tokenClaims = null;

    if (token) {
      const verification = verifyEntryPassToken(token);
      if (!verification.valid) {
        throw new AppError(verification.error || "Invalid entry pass token", 400);
      }
      tokenClaims = verification.claims;
      lookupRegId = tokenClaims.rid;
    }

    let reg = null;
    if (lookupRegId) {
      reg = await registrationRepository.findRegistrationById(lookupRegId, { populate: true });
    } else if (regNo) {
      reg = await registrationRepository.findRegistrationByRegNo(regNo, { populate: true });
    } else {
      throw new AppError("QR token, registration ID, or registration number is required", 400);
    }

    if (!reg) {
      throw new NotFoundError("Registration not found");
    }

    // Tenant & Reviewer Authorization Check
    if (!canReviewRegistration(auth, reg)) {
      throw new ForbiddenError("You cannot check in attendees for another club");
    }

    // Optional Event Scoping
    if (eventSlug && reg.event?.slug && reg.event.slug !== String(eventSlug).trim()) {
      throw new ConflictError(
        `This pass is for '${reg.event?.name || "another event"}' and cannot be used for this event`,
        {
          code: "EVENT_MISMATCH",
          expectedEvent: eventSlug,
          actualEvent: reg.event?.slug,
          eventName: reg.event?.name,
        }
      );
    }

    // Approval status validation
    const isApproved = reg.status === "approved";
    const isCheckedIn = reg.attendanceStatus === "present";

    const responsePayload = {
      id: String(reg._id),
      regNo: reg.regNo || "CONFIRMED",
      studentName: reg.studentName,
      studentEmail: reg.studentEmail,
      studentPhone: reg.studentPhone,
      college: reg.college || "",
      amount: reg.amount,
      status: reg.status,
      attendanceStatus: reg.attendanceStatus || "not_marked",
      checkedInAt: reg.checkedInAt || null,
      checkedInBy: reg.checkedInBy || null,
      checkInSource: reg.checkInSource || null,
      event: {
        id: String(reg.event?._id || reg.event),
        name: reg.event?.name || "",
        slug: reg.event?.slug || "",
        date: reg.event?.date || null,
        venue: reg.event?.venue || "",
      },
      club: {
        id: String(reg.club?._id || reg.club),
        name: reg.club?.name || "",
        slug: reg.club?.slug || "",
      },
    };

    if (!isApproved) {
      return {
        eligible: false,
        reason: "NOT_APPROVED",
        message: `Registration status is '${reg.status}'. Only approved participants can check in.`,
        data: responsePayload,
      };
    }

    if (isCheckedIn) {
      return {
        eligible: false,
        alreadyCheckedIn: true,
        reason: "ALREADY_CHECKED_IN",
        message: `Participant has already checked in on ${new Date(reg.checkedInAt).toLocaleTimeString()}`,
        data: responsePayload,
      };
    }

    return {
      eligible: true,
      reason: "READY_FOR_CHECKIN",
      message: "Ready for check-in",
      data: responsePayload,
    };
  },

  /**
   * Confirms check-in attendance atomically
   * @param {Object} params
   * @param {string} [params.token]
   * @param {string} [params.registrationId]
   * @param {string} [params.regNo]
   * @param {string} [params.eventSlug]
   * @param {boolean} [params.overrideDuplicate=false]
   * @param {string} [params.source="qr_scan"]
   * @param {string} [params.notes=""]
   * @param {Object} params.auth
   * @returns {Promise<Object>}
   */
  async confirmCheckIn({
    token,
    registrationId,
    regNo,
    eventSlug,
    overrideDuplicate = false,
    source = "qr_scan",
    notes = "",
    auth,
  }) {
    let lookupRegId = registrationId || null;

    if (token) {
      const verification = verifyEntryPassToken(token);
      if (!verification.valid) {
        throw new AppError(verification.error || "Invalid entry pass token", 400);
      }
      lookupRegId = verification.claims.rid;
    }

    const reviewerCode = getReviewerCode(auth);

    const result = await withTransaction(async (session) => {
      let reg = null;
      if (lookupRegId) {
        reg = await registrationRepository.findRegistrationById(lookupRegId, {
          populate: true,
          session,
        });
      } else if (regNo) {
        reg = await registrationRepository.findRegistrationByRegNo(regNo, {
          populate: true,
          session,
        });
      } else {
        throw new AppError("QR token, registration ID, or registration number is required", 400);
      }

      if (!reg) {
        throw new NotFoundError("Registration not found");
      }

      // Tenant authorization check
      if (!canReviewRegistration(auth, reg)) {
        throw new ForbiddenError("You cannot check in attendees for another club");
      }

      // Event scoping validation
      if (eventSlug && reg.event?.slug && reg.event.slug !== String(eventSlug).trim()) {
        throw new ConflictError(
          `This pass is for '${reg.event?.name || "another event"}' and cannot be used for this event`,
          {
            code: "EVENT_MISMATCH",
            expectedEvent: eventSlug,
            actualEvent: reg.event?.slug,
          }
        );
      }

      if (reg.status !== "approved") {
        throw new AppError(
          `Cannot check in: registration is in '${reg.status}' status (must be approved)`,
          400
        );
      }

      const wasAlreadyCheckedIn = reg.attendanceStatus === "present";

      if (wasAlreadyCheckedIn && !overrideDuplicate) {
        throw new ConflictError(
          `Participant already checked in at ${reg.checkedInAt ? new Date(reg.checkedInAt).toLocaleTimeString() : "earlier"}`,
          {
            code: "ALREADY_CHECKED_IN",
            checkedInAt: reg.checkedInAt,
            checkedInBy: reg.checkedInBy,
            regNo: reg.regNo,
            studentName: reg.studentName,
          }
        );
      }

      const checkInTime = wasAlreadyCheckedIn ? reg.checkedInAt : new Date();

      reg.attendanceStatus = "present";
      reg.checkedInAt = checkInTime;
      reg.checkedInBy = reviewerCode;
      reg.checkInSource = overrideDuplicate ? "override" : source;
      if (notes) reg.checkInNotes = String(notes).trim();

      if (!Array.isArray(reg.history)) {
        reg.history = [];
      }

      const action = overrideDuplicate ? "check_in_override" : "check_in";
      const actionNote = notes
        ? String(notes).trim()
        : overrideDuplicate
        ? "Check-in override approved by reviewer"
        : source === "manual"
        ? "Manual gate check-in"
        : "QR entry pass scanned";

      reg.history.push({
        action,
        status: "approved",
        performedBy: reviewerCode,
        note: actionNote,
        timestamp: new Date(),
      });

      await reg.save({ session });

      return {
        id: String(reg._id),
        regNo: reg.regNo || "CONFIRMED",
        studentName: reg.studentName,
        studentEmail: reg.studentEmail,
        studentPhone: reg.studentPhone,
        college: reg.college || "",
        amount: reg.amount,
        status: reg.status,
        attendanceStatus: reg.attendanceStatus,
        checkedInAt: reg.checkedInAt,
        checkedInBy: reg.checkedInBy,
        checkInSource: reg.checkInSource,
        checkInNotes: reg.checkInNotes || null,
        history: reg.history,
        event: {
          id: String(reg.event?._id || reg.event),
          name: reg.event?.name || "",
          slug: reg.event?.slug || "",
          date: reg.event?.date || null,
          venue: reg.event?.venue || "",
        },
        club: {
          id: String(reg.club?._id || reg.club),
          name: reg.club?.name || "",
          slug: reg.club?.slug || "",
        },
      };
    });

    // Broadcast live check-in status update to attendee status screen
    statusEmitter.emitStatusUpdate(result.id, result);

    return {
      ok: true,
      message: overrideDuplicate
        ? "Check-in override recorded successfully"
        : "Participant checked in successfully",
      data: result,
    };
  },

  /**
   * Search approved attendees for manual fallback lookup
   * @param {Object} params
   * @param {string} params.search - Search query
   * @param {string} [params.eventSlug] - Optional event filter
   * @param {Object} params.auth - Authenticated user
   * @param {number} [params.limit=20]
   * @returns {Promise<Object>}
   */
  async lookupAttendees({ search, eventSlug, auth, limit = 20 }) {
    let eventId = null;
    if (eventSlug && auth.clubId) {
      const event = await registrationRepository.findEventBySlugAndClub(eventSlug, auth.clubId);
      if (event) eventId = event._id;
    }

    const items = await registrationRepository.searchApprovedRegistrations({
      clubId: auth.clubId,
      eventId,
      search,
      limit: Math.min(Number(limit) || 20, 50),
    });

    return {
      ok: true,
      count: items.length,
      items: items.map((r) => ({
        id: String(r._id),
        regNo: r.regNo || "CONFIRMED",
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        studentPhone: r.studentPhone,
        college: r.college || "",
        amount: r.amount,
        status: r.status,
        attendanceStatus: r.attendanceStatus || "not_marked",
        checkedInAt: r.checkedInAt || null,
        checkedInBy: r.checkedInBy || null,
        event: r.event,
        club: r.club,
      })),
    };
  },
};

export default checkInService;
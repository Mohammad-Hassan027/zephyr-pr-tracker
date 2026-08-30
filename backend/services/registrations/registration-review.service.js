import registrationRepository from "../../repositories/registration.repository.js";
import { canReviewRegistration, getReviewerCode } from "../../policies/registration.policy.js";
import { withTransaction } from "../../utils/transaction.js";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { statusEmitter } from "../../utils/statusEmitter.js";
import cloudinary, { isCloudinaryConfigured } from "../../config/cloudinary.js";

const REVIEWABLE_STATUSES = ["pending", "resubmitted", "under_review", "needs_correction"];

/**
 * Builds capacity info snapshot for API responses and status emitter payloads.
 * Returns null-safe defaults when the event has no capacity set.
 */
function buildCapacitySnapshot(event) {
  if (!event) return null;
  const capacity = event.capacity ?? null;
  const approvedCount = event.approvedCount ?? 0;
  const remaining = capacity === null ? null : Math.max(0, capacity - approvedCount);
  return {
    capacity,
    approvedCount,
    remaining,
    isFull: capacity !== null && approvedCount >= capacity,
  };
}

export const registrationReviewService = {
  async requestCorrection({ id, note, auth }) {
    const trimmedNote = typeof note === "string" ? note.trim() : "";
    if (!trimmedNote) {
      throw new AppError("Correction note is required explaining what must be fixed", 400);
    }

    const result = await withTransaction(async (session) => {
      const reg = await registrationRepository.findRegistrationById(id, {
        populate: true,
        session,
      });

      if (!reg) {
        throw new NotFoundError("Registration not found");
      }

      if (!canReviewRegistration(auth, reg)) {
        throw new ForbiddenError("You cannot review this registration");
      }

      if (reg.status === "approved") {
        throw new ConflictError("Cannot request correction on an approved registration");
      }

      const reviewerCode = getReviewerCode(auth);

      reg.status = "needs_correction";
      reg.correctionNote = trimmedNote;
      reg.lastCorrectionRequestedAt = new Date();
      reg.reviewedBy = reviewerCode;

      if (!Array.isArray(reg.history)) {
        reg.history = [];
      }

      reg.history.push({
        action: "requested_correction",
        status: "needs_correction",
        performedBy: reviewerCode,
        note: trimmedNote,
        timestamp: new Date(),
      });

      await reg.save({ session });

      return {
        id: reg._id,
        status: reg.status,
        correctionNote: reg.correctionNote,
        lastCorrectionRequestedAt: reg.lastCorrectionRequestedAt,
        studentName: reg.studentName,
        studentEmail: reg.studentEmail,
        studentPhone: reg.studentPhone,
        college: reg.college,
        amount: reg.amount,
        createdAt: reg.createdAt,
        event: reg.event,
        reviewedBy: reg.reviewedBy,
        history: reg.history,
      };
    });

    statusEmitter.emitStatusUpdate(id, result);

    return {
      ok: true,
      message: "Correction requested successfully",
      data: result,
    };
  },

  async approveRegistration({ id, auth }) {
    const result = await withTransaction(async (session) => {
      const reg = await registrationRepository.findRegistrationById(id, {
        populate: true,
        session,
      });

      if (!reg) {
        throw new NotFoundError("Registration not found");
      }

      if (!canReviewRegistration(auth, reg)) {
        throw new ForbiddenError("You cannot review this registration");
      }

      // --- Idempotency: already approved — return early without modifying capacity ---
      if (reg.status === "approved") {
        const capacitySnapshot = buildCapacitySnapshot(reg.event);
        return {
          id: reg._id,
          regNo: reg.regNo,
          status: reg.status,
          studentName: reg.studentName,
          studentEmail: reg.studentEmail,
          studentPhone: reg.studentPhone,
          college: reg.college,
          amount: reg.amount,
          createdAt: reg.createdAt,
          event: reg.event,
          reviewedBy: reg.reviewedBy,
          history: reg.history,
          capacitySnapshot,
          _alreadyApproved: true,
        };
      }

      if (!REVIEWABLE_STATUSES.includes(reg.status)) {
        throw new ConflictError(`Registration has already been finalized (${reg.status})`);
      }

      // --- Atomic capacity reservation ---
      // Uses a single conditional findOneAndUpdate (same pattern as Counter.js).
      // The filter passes only when: capacity is null OR approvedCount < capacity.
      // If the event has a capacity set and is full, findOneAndUpdate returns null.
      const eventId = reg.event?._id || reg.event;
      if (eventId) {
        const event = await registrationRepository.findEventById(eventId, session);
        if (event) {
          // Attempt atomic reservation — null returned only if event capacity is exceeded
          const reserved = await registrationRepository.reserveEventCapacity(eventId, session);
          if (!reserved) {
            const info = await registrationRepository.getEventCapacityInfo(eventId);
            throw new ConflictError(
              `This event has reached its maximum registration capacity of ${event.capacity} attendees`,
              {
                code: "EVENT_FULL",
                capacity: info?.capacity ?? event.capacity,
                approvedCount: info?.approvedCount ?? event.approvedCount,
                remaining: 0,
              }
            );
          }
          // reserved is the updated event — use it for the response snapshot
          reg._reservedEvent = reserved;
        }
      }

      const regNo = reg.regNo || (await registrationRepository.getNextRegistrationSequence(session));
      const reviewerCode = getReviewerCode(auth);

      reg.regNo = regNo;
      reg.status = "approved";
      reg.reviewedBy = reviewerCode;

      if (!Array.isArray(reg.history)) {
        reg.history = [];
      }

      reg.history.push({
        action: "approved",
        status: "approved",
        performedBy: reviewerCode,
        timestamp: new Date(),
      });

      await reg.save({ session });

      const capacitySnapshot = buildCapacitySnapshot(reg._reservedEvent || reg.event);

      return {
        id: reg._id,
        regNo: reg.regNo,
        status: reg.status,
        studentName: reg.studentName,
        studentEmail: reg.studentEmail,
        studentPhone: reg.studentPhone,
        college: reg.college,
        amount: reg.amount,
        createdAt: reg.createdAt,
        event: reg.event,
        reviewedBy: reg.reviewedBy,
        history: reg.history,
        capacitySnapshot,
      };
    });

    statusEmitter.emitStatusUpdate(id, result);

    return {
      ok: true,
      message: "Registration approved successfully",
      data: result,
      regNo: result.regNo,
      capacitySnapshot: result.capacitySnapshot,
    };
  },

  async rejectRegistration({ id, reason, auth }) {
    let publicIdToClean = null;

    const result = await withTransaction(async (session) => {
      const reg = await registrationRepository.findRegistrationById(id, {
        populate: true,
        session,
      });
      if (!reg) throw new NotFoundError("Registration not found");

      if (!canReviewRegistration(auth, reg)) {
        throw new ForbiddenError("You cannot review this registration");
      }

      const wasApproved = reg.status === "approved";

      if (!REVIEWABLE_STATUSES.includes(reg.status) && !wasApproved) {
        throw new ConflictError(`Registration has already been finalized (${reg.status})`);
      }

      const reviewerCode = getReviewerCode(auth);

      reg.status = "rejected";
      reg.reviewedBy = reviewerCode;
      reg.rejectionReason = reason || "Payment could not be verified";

      if (!Array.isArray(reg.history)) {
        reg.history = [];
      }

      reg.history.push({
        action: "rejected",
        status: "rejected",
        performedBy: reviewerCode,
        note: reg.rejectionReason,
        timestamp: new Date(),
      });

      await reg.save({ session });

      // --- Capacity release: if the registration was previously approved, release the slot ---
      if (wasApproved) {
        const eventId = reg.event?._id || reg.event;
        if (eventId) {
          // releaseEventCapacity is idempotent: will not go below 0
          await registrationRepository.releaseEventCapacity(eventId, session);
        }
      }

      publicIdToClean = reg.paymentScreenshotPublicId || null;

      return {
        id: reg._id,
        status: reg.status,
        rejectionReason: reg.rejectionReason,
        studentName: reg.studentName,
        studentEmail: reg.studentEmail,
        event: reg.event,
        history: reg.history,
        paymentScreenshotPublicId: reg.paymentScreenshotPublicId,
      };
    });

    if (publicIdToClean && isCloudinaryConfigured()) {
      try {
        cloudinary.uploader.destroy(publicIdToClean).catch(() => {});
      } catch (err) {}
    }

    statusEmitter.emitStatusUpdate(id, result);

    return {
      ok: true,
      message: "Registration rejected",
      status: result.status,
    };
  },

  async bulkApproveRegistrations({ ids, auth }) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError("ids must be a non-empty array", 400);
    }

    const results = [];
    const errors = [];

    await withTransaction(async (session) => {
      for (const id of ids) {
        try {
          const reg = await registrationRepository.findRegistrationById(id, {
            populate: true,
            session,
          });

          if (!reg) {
            errors.push({ id, error: "Registration not found" });
            continue;
          }

          if (!canReviewRegistration(auth, reg)) {
            errors.push({ id, error: "Unauthorized to review this registration" });
            continue;
          }

          // Idempotency: skip already-approved without double-counting
          if (reg.status === "approved") {
            results.push({
              id: reg._id,
              regNo: reg.regNo,
              status: reg.status,
              studentName: reg.studentName,
              studentEmail: reg.studentEmail,
              event: reg.event,
              reviewedBy: reg.reviewedBy,
            });
            continue;
          }

          if (!REVIEWABLE_STATUSES.includes(reg.status)) {
            errors.push({ id, error: `Already finalized (${reg.status})` });
            continue;
          }

          // Atomic per-item capacity reservation
          const eventId = reg.event?._id || reg.event;
          if (eventId) {
            const event = await registrationRepository.findEventById(eventId, session);
            if (event) {
              const reserved = await registrationRepository.reserveEventCapacity(eventId, session);
              if (!reserved) {
                errors.push({
                  id,
                  error: "Event capacity reached",
                  code: "EVENT_FULL",
                  capacity: event.capacity,
                });
                continue;
              }
            }
          }

          const regNo = reg.regNo || (await registrationRepository.getNextRegistrationSequence(session));
          const reviewerCode = getReviewerCode(auth);

          reg.regNo = regNo;
          reg.status = "approved";
          reg.reviewedBy = reviewerCode;

          if (!Array.isArray(reg.history)) {
            reg.history = [];
          }

          reg.history.push({
            action: "approved",
            status: "approved",
            performedBy: reviewerCode,
            timestamp: new Date(),
          });

          await reg.save({ session });

          results.push({
            id: reg._id,
            regNo: reg.regNo,
            status: reg.status,
            studentName: reg.studentName,
            studentEmail: reg.studentEmail,
            studentPhone: reg.studentPhone,
            college: reg.college,
            amount: reg.amount,
            createdAt: reg.createdAt,
            event: reg.event,
            reviewedBy: reg.reviewedBy,
            history: reg.history,
          });
        } catch (itemErr) {
          errors.push({ id, error: itemErr.message });
        }
      }
    });

    for (const item of results) {
      statusEmitter.emitStatusUpdate(item.id, item);
    }

    return {
      ok: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    };
  },

  async bulkRejectRegistrations({ ids, reason, auth }) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new AppError("ids must be a non-empty array", 400);
    }

    const rejectionReason = reason || "Payment could not be verified";
    const results = [];
    const errors = [];
    const publicIdsToClean = [];

    await withTransaction(async (session) => {
      for (const id of ids) {
        try {
          const reg = await registrationRepository.findRegistrationById(id, {
            populate: true,
            session,
          });

          if (!reg) {
            errors.push({ id, error: "Registration not found" });
            continue;
          }

          if (!canReviewRegistration(auth, reg)) {
            errors.push({ id, error: "Unauthorized to review this registration" });
            continue;
          }

          const wasApproved = reg.status === "approved";

          if (!REVIEWABLE_STATUSES.includes(reg.status) && !wasApproved) {
            errors.push({ id, error: `Already finalized (${reg.status})` });
            continue;
          }

          const reviewerCode = getReviewerCode(auth);

          reg.status = "rejected";
          reg.reviewedBy = reviewerCode;
          reg.rejectionReason = rejectionReason;

          if (!Array.isArray(reg.history)) {
            reg.history = [];
          }

          reg.history.push({
            action: "rejected",
            status: "rejected",
            performedBy: reviewerCode,
            note: rejectionReason,
            timestamp: new Date(),
          });

          await reg.save({ session });

          // Release capacity if the registration was previously approved
          if (wasApproved) {
            const eventId = reg.event?._id || reg.event;
            if (eventId) {
              await registrationRepository.releaseEventCapacity(eventId, session);
            }
          }

          if (reg.paymentScreenshotPublicId) {
            publicIdsToClean.push(reg.paymentScreenshotPublicId);
          }

          results.push({
            id: reg._id,
            status: reg.status,
            rejectionReason: reg.rejectionReason,
            studentName: reg.studentName,
            studentEmail: reg.studentEmail,
            event: reg.event,
            history: reg.history,
          });
        } catch (itemErr) {
          errors.push({ id, error: itemErr.message });
        }
      }
    });

    if (isCloudinaryConfigured()) {
      for (const pubId of publicIdsToClean) {
        try {
          cloudinary.uploader.destroy(pubId).catch(() => {});
        } catch (err) {}
      }
    }

    for (const item of results) {
      statusEmitter.emitStatusUpdate(item.id, item);
    }

    return {
      ok: true,
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    };
  },
};

export default registrationReviewService;

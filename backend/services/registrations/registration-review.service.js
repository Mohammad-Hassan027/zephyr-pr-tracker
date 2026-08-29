import registrationRepository from "../../repositories/registration.repository.js";
import { canReviewRegistration, getReviewerCode } from "../../policies/registration.policy.js";
import { withTransaction } from "../../utils/transaction.js";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { statusEmitter } from "../../utils/statusEmitter.js";
import cloudinary from "../../config/cloudinary.js";

const REVIEWABLE_STATUSES = ["pending", "resubmitted", "under_review", "needs_correction"];

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

      if (!REVIEWABLE_STATUSES.includes(reg.status)) {
        throw new ConflictError(`Registration has already been finalized (${reg.status})`);
      }

      if (reg.event) {
        const eventId = reg.event._id || reg.event;
        const event = await registrationRepository.findEventById(eventId, session);
        if (event && event.capacity) {
          const approvedCount = await registrationRepository.countApprovedRegistrationsForEvent(
            event._id,
            session
          );

          if (approvedCount >= event.capacity) {
            throw new ConflictError("Event capacity has already been reached");
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
      };
    });

    statusEmitter.emitStatusUpdate(id, result);

    return {
      ok: true,
      message: "Registration approved successfully",
      data: result,
      regNo: result.regNo,
    };
  },

  async rejectRegistration({ id, reason, auth }) {
    const result = await withTransaction(async (session) => {
      const reg = await registrationRepository.findRegistrationById(id, {
        populate: true,
        session,
      });
      if (!reg) throw new NotFoundError("Registration not found");

      if (!REVIEWABLE_STATUSES.includes(reg.status)) {
        throw new ConflictError(`Registration has already been finalized (${reg.status})`);
      }

      if (!canReviewRegistration(auth, reg)) {
        throw new ForbiddenError("You cannot review this registration");
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

    if (result.paymentScreenshotPublicId) {
      cloudinary.uploader.destroy(result.paymentScreenshotPublicId).catch(() => {});
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

          if (!REVIEWABLE_STATUSES.includes(reg.status)) {
            errors.push({ id, error: `Already finalized (${reg.status})` });
            continue;
          }

          if (reg.event) {
            const eventId = reg.event._id || reg.event;
            const event = await registrationRepository.findEventById(eventId, session);
            if (event && event.capacity) {
              const approvedCount = await registrationRepository.countApprovedRegistrationsForEvent(
                event._id,
                session
              );

              if (approvedCount >= event.capacity) {
                errors.push({ id, error: "Event capacity reached" });
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

          if (!REVIEWABLE_STATUSES.includes(reg.status)) {
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

    for (const pubId of publicIdsToClean) {
      cloudinary.uploader.destroy(pubId).catch(() => {});
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

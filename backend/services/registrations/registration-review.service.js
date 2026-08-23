import registrationRepository from "../../repositories/registration.repository.js";
import { canReviewRegistration, getReviewerCode } from "../../policies/registration.policy.js";
import { withTransaction } from "../../utils/transaction.js";
import { AppError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { statusEmitter } from "../../utils/statusEmitter.js";
import cloudinary from "../../config/cloudinary.js";

export const registrationReviewService = {
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

      if (reg.status !== "pending") {
        throw new ConflictError(`Registration has already been reviewed (${reg.status})`);
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

      const regNo = await registrationRepository.getNextRegistrationSequence(session);

      reg.regNo = regNo;
      reg.status = "approved";
      reg.reviewedBy = getReviewerCode(auth);
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

      if (reg.status !== "pending") {
        throw new ConflictError(`Registration has already been reviewed (${reg.status})`);
      }

      if (!canReviewRegistration(auth, reg)) {
        throw new ForbiddenError("You cannot review this registration");
      }

      reg.status = "rejected";
      reg.reviewedBy = getReviewerCode(auth);
      reg.rejectionReason = reason || "Payment could not be verified";
      await reg.save({ session });

      return {
        id: reg._id,
        status: reg.status,
        rejectionReason: reg.rejectionReason,
        studentName: reg.studentName,
        studentEmail: reg.studentEmail,
        event: reg.event,
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

          if (reg.status !== "pending") {
            errors.push({ id, error: `Already reviewed (${reg.status})` });
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

          const regNo = await registrationRepository.getNextRegistrationSequence(session);

          reg.regNo = regNo;
          reg.status = "approved";
          reg.reviewedBy = getReviewerCode(auth);
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

          if (reg.status !== "pending") {
            errors.push({ id, error: `Already reviewed (${reg.status})` });
            continue;
          }

          reg.status = "rejected";
          reg.reviewedBy = getReviewerCode(auth);
          reg.rejectionReason = rejectionReason;
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

import registrationRepository from "../../repositories/registration.repository.js";
import {
  toTrimmedString,
  isValidCloudinaryPublicId,
  isValidCloudinaryImageUrl,
} from "../../validators/registration.validators.js";
import { AppError, ConflictError, NotFoundError } from "../../utils/errors.js";
import { statusEmitter } from "../../utils/statusEmitter.js";

export const registrationService = {
  async createRegistration(body) {
    const {
      studentName,
      studentEmail,
      studentPhone,
      college,
      amount,
      utr,
      eventSlug,
      clubSlug,
      referralCode,
      paymentScreenshot,
      paymentScreenshotPublicId,
    } = body;

    if (!clubSlug) {
      throw new AppError("Club identifier is required", 400);
    }

    const club = await registrationRepository.findClubBySlug(clubSlug);
    if (!club) {
      throw new NotFoundError("Club not found");
    }

    const event = await registrationRepository.findEventBySlugAndClub(eventSlug, club._id);
    if (!event) {
      throw new NotFoundError("Event not found for this club");
    }

    if (event.capacity) {
      const count = await registrationRepository.countApprovedRegistrationsForEvent(event._id);
      if (count >= event.capacity) {
        throw new AppError("Event is full", 400);
      }
    }

    let validCode = null;
    if (referralCode) {
      const member = await registrationRepository.findPRMemberByCodeAndClub(referralCode, event.club);
      if (member) validCode = member.code;
    }

    const screenshotUrl = toTrimmedString(paymentScreenshot);
    const screenshotPublicId = toTrimmedString(paymentScreenshotPublicId);

    if (!screenshotUrl || !screenshotPublicId) {
      throw new AppError("Payment screenshot URL and public ID are required", 400);
    }

    if (!isValidCloudinaryPublicId(screenshotPublicId)) {
      throw new AppError("Invalid payment screenshot public ID", 400);
    }

    if (!isValidCloudinaryImageUrl(screenshotUrl, screenshotPublicId)) {
      throw new AppError("Invalid payment screenshot URL", 400);
    }

    try {
      const initialHistory = [
        {
          action: "submitted",
          status: "pending",
          performedBy: "contributor",
          note: "Initial submission",
          timestamp: new Date(),
        },
      ];

      const registration = await registrationRepository.createRegistration({
        studentName,
        studentEmail,
        studentPhone,
        college,
        amount: amount ? Number(amount) : 0,
        utr: toTrimmedString(utr),
        event: event._id,
        club: event.club,
        referralCode: validCode,
        paymentScreenshot: screenshotUrl,
        paymentScreenshotPublicId: screenshotPublicId,
        status: "pending",
        history: initialHistory,
      });

      return { id: registration._id, status: registration.status };
    } catch (err) {
      if (err.code === 11000) {
        try {
          const existing = await registrationRepository.findRegistrationByEventAndEmail(
            event._id,
            studentEmail
          );

          throw new ConflictError("You already registered for this event", {
            registrationId: existing?._id || null,
            status: existing?.status || null,
          });
        } catch (lookupErr) {
          if (lookupErr instanceof ConflictError) throw lookupErr;
          throw new ConflictError("You already registered for this event");
        }
      }
      throw err;
    }
  },

  async resubmitRegistration(id, body) {
    const reg = await registrationRepository.findRegistrationById(id);
    if (!reg) {
      throw new NotFoundError("Registration not found");
    }

    if (reg.status !== "needs_correction") {
      throw new AppError(
        `Cannot resubmit registration in '${reg.status}' status. Resubmission is only allowed when status is 'needs_correction'.`,
        400
      );
    }

    const {
      studentName,
      studentPhone,
      college,
      amount,
      utr,
      paymentScreenshot,
      paymentScreenshotPublicId,
    } = body;

    let screenshotUrl = reg.paymentScreenshot;
    let screenshotPublicId = reg.paymentScreenshotPublicId;

    if (paymentScreenshot || paymentScreenshotPublicId) {
      screenshotUrl = toTrimmedString(paymentScreenshot) || reg.paymentScreenshot;
      screenshotPublicId = toTrimmedString(paymentScreenshotPublicId) || reg.paymentScreenshotPublicId;

      if (!screenshotUrl || !screenshotPublicId) {
        throw new AppError("Payment screenshot URL and public ID are required when updating screenshot", 400);
      }

      if (!isValidCloudinaryPublicId(screenshotPublicId)) {
        throw new AppError("Invalid payment screenshot public ID", 400);
      }

      if (!isValidCloudinaryImageUrl(screenshotUrl, screenshotPublicId)) {
        throw new AppError("Invalid payment screenshot URL", 400);
      }
    }

    const changes = {};
    if (studentName && studentName !== reg.studentName) {
      changes.studentName = { from: reg.studentName, to: studentName };
      reg.studentName = studentName;
    }
    if (studentPhone !== undefined && studentPhone !== reg.studentPhone) {
      changes.studentPhone = { from: reg.studentPhone, to: studentPhone };
      reg.studentPhone = studentPhone;
    }
    if (college !== undefined && college !== reg.college) {
      changes.college = { from: reg.college, to: college };
      reg.college = college;
    }
    if (amount !== undefined && Number(amount) !== reg.amount) {
      changes.amount = { from: reg.amount, to: Number(amount) };
      reg.amount = Number(amount);
    }
    if (utr !== undefined && toTrimmedString(utr) !== reg.utr) {
      changes.utr = { from: reg.utr, to: toTrimmedString(utr) };
      reg.utr = toTrimmedString(utr);
    }
    if (screenshotUrl !== reg.paymentScreenshot) {
      changes.paymentScreenshot = { from: "previous", to: "updated" };
      reg.paymentScreenshot = screenshotUrl;
      reg.paymentScreenshotPublicId = screenshotPublicId;
    }

    reg.status = "resubmitted";
    reg.resubmittedAt = new Date();

    if (!Array.isArray(reg.history)) {
      reg.history = [];
    }

    reg.history.push({
      action: "resubmitted",
      status: "resubmitted",
      performedBy: "contributor",
      note: "Resubmitted corrected details for review",
      changes: Object.keys(changes).length > 0 ? changes : null,
      timestamp: new Date(),
    });

    await reg.save();

    const responseData = {
      id: reg._id,
      status: reg.status,
      regNo: reg.regNo || null,
      studentName: reg.studentName,
      studentEmail: reg.studentEmail,
      studentPhone: reg.studentPhone,
      college: reg.college,
      amount: reg.amount,
      utr: reg.utr,
      paymentScreenshot: reg.paymentScreenshot,
      correctionNote: reg.correctionNote,
      lastCorrectionRequestedAt: reg.lastCorrectionRequestedAt,
      resubmittedAt: reg.resubmittedAt,
      history: reg.history,
      createdAt: reg.createdAt,
      event: reg.event,
      club: reg.club,
    };

    statusEmitter.emitStatusUpdate(id, responseData);

    return {
      ok: true,
      message: "Registration resubmitted successfully for review",
      data: responseData,
    };
  },

  async checkDuplicate({ clubSlug, eventSlug, studentEmail }) {
    if (!clubSlug || !eventSlug || !studentEmail) {
      throw new AppError("clubSlug, eventSlug, and studentEmail are required", 400);
    }

    const club = await registrationRepository.findClubBySlug(clubSlug);
    if (!club) {
      throw new NotFoundError("Club not found");
    }

    const event = await registrationRepository.findEventBySlugAndClub(eventSlug, club._id);
    if (!event) {
      throw new NotFoundError("Event not found");
    }

    const existing = await registrationRepository.findRegistrationByEventAndEmail(
      event._id,
      studentEmail
    );

    if (existing) {
      return {
        exists: true,
        registrationId: existing._id,
        status: existing.status,
        regNo: existing.regNo || null,
      };
    }

    return { exists: false };
  },

  async lookupRegistrations({ studentEmail, clubSlug }) {
    if (!studentEmail) {
      throw new AppError("Student email is required", 400);
    }

    const filter = {
      studentEmail: String(studentEmail).trim().toLowerCase(),
    };

    if (clubSlug) {
      const club = await registrationRepository.findClubBySlug(clubSlug);
      if (club) {
        filter.club = club._id;
      }
    }

    const registrations = await registrationRepository.findRegistrationsByFilter(filter);

    return {
      registrations: registrations.map((r) => ({
        id: r._id,
        regNo: r.regNo || null,
        status: r.status,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        studentPhone: r.studentPhone,
        college: r.college,
        amount: r.amount,
        utr: r.utr || "",
        paymentScreenshot: r.paymentScreenshot,
        createdAt: r.createdAt,
        rejectionReason: r.rejectionReason,
        correctionNote: r.correctionNote,
        lastCorrectionRequestedAt: r.lastCorrectionRequestedAt,
        resubmittedAt: r.resubmittedAt,
        history: r.history || [],
        event: r.event,
        club: r.club,
      })),
    };
  },

  async getRegistrationById(id) {
    const reg = await registrationRepository.findRegistrationById(id);
    if (!reg) {
      throw new NotFoundError("Not found");
    }

    return {
      id: reg._id,
      status: reg.status,
      rejectionReason: reg.rejectionReason,
      correctionNote: reg.correctionNote,
      lastCorrectionRequestedAt: reg.lastCorrectionRequestedAt,
      resubmittedAt: reg.resubmittedAt,
      history: reg.history || [],
      regNo: reg.regNo,
      studentName: reg.studentName,
      studentEmail: reg.studentEmail,
      studentPhone: reg.studentPhone,
      college: reg.college,
      amount: reg.amount,
      utr: reg.utr || "",
      paymentScreenshot: reg.paymentScreenshot,
      createdAt: reg.createdAt,
      event: reg.event,
      club: reg.club,
    };
  },

  async streamRegistrationStatus(id, req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    try {
      const reg = await registrationRepository.findRegistrationById(id);
      if (!reg) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: "Registration not found" })}\n\n`);
        return res.end();
      }

      const payload = {
        id: reg._id,
        status: reg.status,
        rejectionReason: reg.rejectionReason,
        correctionNote: reg.correctionNote,
        lastCorrectionRequestedAt: reg.lastCorrectionRequestedAt,
        resubmittedAt: reg.resubmittedAt,
        history: reg.history || [],
        regNo: reg.regNo,
        studentName: reg.studentName,
        studentEmail: reg.studentEmail,
        studentPhone: reg.studentPhone,
        college: reg.college,
        amount: reg.amount,
        utr: reg.utr || "",
        paymentScreenshot: reg.paymentScreenshot,
        createdAt: reg.createdAt,
        event: reg.event,
        club: reg.club,
      };

      res.write(`event: status\ndata: ${JSON.stringify(payload)}\n\n`);

      if (["approved", "rejected"].includes(reg.status)) {
        return res.end();
      }

      const unsubscribe = statusEmitter.subscribe(id, (updatedData) => {
        res.write(`event: status\ndata: ${JSON.stringify(updatedData)}\n\n`);
        if (["approved", "rejected"].includes(updatedData.status)) {
          unsubscribe();
          res.end();
        }
      });

      const heartbeat = setInterval(() => {
        res.write(": keepalive\n\n");
      }, 15000);

      req.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  },
};

export default registrationService;

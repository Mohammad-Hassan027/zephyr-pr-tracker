import { once } from "node:events";
import mongoose from "mongoose";
import Registration from "../../models/Registration.js";
import Event from "../../models/Event.js";
import Club from "../../models/Club.js";
import PRMember from "../../models/PRMember.js";
import { formatCsvRow, CSV_BOM } from "../../utils/csv-sanitizer.js";
import { buildDateFilter } from "../../validators/registration.validators.js";
import { ForbiddenError, BadRequestError } from "../../utils/errors.js";

/**
 * Builds the tenant-isolated Mongoose filter based on caller identity and query params.
 */
export async function buildExportFilter(auth, query = {}, exportType = "all") {
  if (!auth || !auth.role) {
    throw new ForbiddenError("Authentication required");
  }

  const filter = {};

  // 1. Enforce strict multi-tenant scoping
  if (auth.role === "club" || auth.role === "admin") {
    if (!auth.clubId) {
      throw new ForbiddenError("Club identity required");
    }
    filter.club = new mongoose.Types.ObjectId(String(auth.clubId));

    // Prevent cross-club parameter tampering
    if (query.club && String(query.club) !== String(auth.clubId) && String(query.club) !== String(auth.clubSlug)) {
      throw new ForbiddenError("Cannot export records from another club");
    }
  } else if (auth.role === "pr") {
    if (!auth.clubId || !auth.code) {
      throw new ForbiddenError("PR member identity required");
    }
    filter.club = new mongoose.Types.ObjectId(String(auth.clubId));
    filter.referralCode = String(auth.code).toUpperCase();
  } else if (auth.role === "platform_admin") {
    // Platform super-admin can optionally filter by club
    if (query.club) {
      if (mongoose.Types.ObjectId.isValid(query.club)) {
        filter.club = new mongoose.Types.ObjectId(String(query.club));
      } else {
        const c = await Club.findOne({ slug: String(query.club).toLowerCase() });
        if (c) filter.club = c._id;
      }
    }
  } else {
    throw new ForbiddenError("Access denied");
  }

  // 2. Filter by export type / status
  switch (exportType) {
    case "approved":
      filter.status = "approved";
      break;
    case "pending":
      filter.status = { $in: ["pending", "resubmitted", "under_review"] };
      break;
    case "rejected":
      filter.status = "rejected";
      break;
    case "needs_correction":
      filter.status = "needs_correction";
      break;
    case "attendance":
      // Attendance records are typically for approved registrations, but can filter by attendance status
      if (query.status) {
        filter.status = query.status;
      } else {
        filter.status = "approved";
      }
      break;
    case "all":
    case "registrations":
    default:
      if (query.status && query.status !== "all") {
        filter.status = query.status;
      }
      break;
  }

  // 3. Filter by Event (ID or Slug)
  if (query.event || query.eventId) {
    const eventParam = String(query.event || query.eventId).trim();
    if (mongoose.Types.ObjectId.isValid(eventParam)) {
      filter.event = new mongoose.Types.ObjectId(eventParam);
    } else {
      const eventQuery = { slug: eventParam };
      if (filter.club) eventQuery.club = filter.club;
      const foundEvent = await Event.findOne(eventQuery);
      if (foundEvent) {
        filter.event = foundEvent._id;
      } else {
        // Event not found -> force empty result
        filter.event = new mongoose.Types.ObjectId();
      }
    }
  }

  // 4. Filter by Referral Code (for club admin)
  if (auth.role !== "pr" && (query.code || query.referralCode)) {
    filter.referralCode = String(query.code || query.referralCode).trim().toUpperCase();
  }

  // 5. Filter by Attendance Status
  if (query.attendanceStatus && ["present", "absent", "not_marked"].includes(query.attendanceStatus)) {
    filter.attendanceStatus = query.attendanceStatus;
  }

  // 6. Filter by College
  if (query.college) {
    filter.college = { $regex: String(query.college).trim(), $options: "i" };
  }

  // 7. Filter by Date Range (createdAt or updatedAt)
  const dateFilter = buildDateFilter(query.from, query.to);
  if (dateFilter) {
    if (query.dateField === "reviewedAt" || query.dateField === "updatedAt") {
      filter.updatedAt = dateFilter;
    } else {
      filter.createdAt = dateFilter;
    }
  }

  return filter;
}

/**
 * Safely writes a CSV chunk to the HTTP response stream with backpressure handling.
 */
async function writeChunk(res, chunk) {
  if (!res.write(chunk)) {
    await once(res, "drain");
  }
}

/**
 * Computes human-readable payment status.
 */
function getPaymentStatus(reg) {
  if (!reg.amount || reg.amount === 0) return "Free";
  if (reg.status === "approved") return "Verified";
  if (reg.status === "rejected") return "Rejected";
  if (reg.status === "needs_correction") return "Correction Requested";
  return "Pending Verification";
}

/**
 * Streams registration data as CSV to the HTTP response.
 */
export async function streamRegistrationsCsv({ auth, query, res, exportType = "all" }) {
  const filter = await buildExportFilter(auth, query, exportType);

  // Write UTF-8 BOM for Excel compatibility
  await writeChunk(res, CSV_BOM);

  // Define Standard Columns
  let headers = [];
  if (exportType === "attendance") {
    headers = [
      "Registration ID",
      "Participant Name",
      "Email",
      "Phone",
      "College",
      "Event",
      "Club",
      "Registration Status",
      "Attendance Status",
      "Check-in Time",
      "Referral Code",
      "Created Date",
    ];
  } else {
    headers = [
      "Registration ID",
      "Participant Name",
      "Email",
      "Phone",
      "College",
      "Event",
      "Club",
      "Registration Status",
      "Payment Status",
      "Payment Amount (INR)",
      "UTR / Ref Number",
      "Referral Code",
      "Created Date",
      "Reviewed Date",
      "Reviewed By",
      "Rejection Reason",
      "Attendance Status",
      "Check-in Time",
      "Custom Fields",
    ];
  }

  await writeChunk(res, formatCsvRow(headers));

  // Stream documents from MongoDB cursor to avoid high memory allocation
  const cursor = Registration.find(filter)
    .populate("event", "name slug venue fee date")
    .populate("club", "name slug")
    .sort({ createdAt: -1 })
    .lean()
    .cursor();

  for await (const reg of cursor) {
    const regId = reg.regNo || String(reg._id);
    const participantName = reg.studentName || "";
    const email = reg.studentEmail || "";
    const phone = reg.studentPhone || "";
    const college = reg.college || "";
    const eventName = reg.event?.name || "";
    const clubName = reg.club?.name || "";
    const status = reg.status || "pending";
    const paymentStatus = getPaymentStatus(reg);
    const amount = reg.amount ?? 0;
    const utr = reg.utr || "";
    const referralCode = reg.referralCode || "Direct";
    const createdAt = reg.createdAt ? new Date(reg.createdAt).toISOString() : "";
    const reviewedAt =
      reg.status === "approved" || reg.status === "rejected"
        ? reg.updatedAt
          ? new Date(reg.updatedAt).toISOString()
          : ""
        : "";
    const reviewedBy = reg.reviewedBy || "";
    const rejectionReason = reg.rejectionReason || "";
    const attendanceStatus = reg.attendanceStatus || "not_marked";
    const checkInTime = reg.checkedInAt ? new Date(reg.checkedInAt).toISOString() : "";
    const customFieldsStr = reg.customFields && Object.keys(reg.customFields).length > 0
      ? JSON.stringify(reg.customFields)
      : "";

    let row = [];
    if (exportType === "attendance") {
      row = [
        regId,
        participantName,
        email,
        phone,
        college,
        eventName,
        clubName,
        status,
        attendanceStatus,
        checkInTime,
        referralCode,
        createdAt,
      ];
    } else {
      row = [
        regId,
        participantName,
        email,
        phone,
        college,
        eventName,
        clubName,
        status,
        paymentStatus,
        amount,
        utr,
        referralCode,
        createdAt,
        reviewedAt,
        reviewedBy,
        rejectionReason,
        attendanceStatus,
        checkInTime,
        customFieldsStr,
      ];
    }

    await writeChunk(res, formatCsvRow(row));
  }

  res.end();
}

/**
 * Streams PR referral performance leaderboard / summary as CSV.
 */
export async function streamReferralPerformanceCsv({ auth, query, res }) {
  if (auth.role !== "club" && auth.role !== "admin" && auth.role !== "platform_admin") {
    throw new ForbiddenError("Club admin access required for referral performance export");
  }

  const clubId = auth.clubId;
  const clubObjId = new mongoose.Types.ObjectId(String(clubId));

  await writeChunk(res, CSV_BOM);

  const headers = [
    "Referral Code",
    "PR Member Name",
    "Approved Registrations",
    "Pending Registrations",
    "Rejected Registrations",
    "Total Referrals",
    "Total Revenue Credited (INR)",
  ];
  await writeChunk(res, formatCsvRow(headers));

  const members = await PRMember.find({ club: clubId }).sort({ name: 1 }).lean();

  const [approvedAgg, pendingAgg, rejectedAgg, revenueAgg] = await Promise.all([
    Registration.aggregate([
      { $match: { club: clubObjId, status: "approved", referralCode: { $ne: null } } },
      { $group: { _id: "$referralCode", count: { $sum: 1 } } },
    ]),
    Registration.aggregate([
      { $match: { club: clubObjId, status: { $in: ["pending", "resubmitted", "under_review"] }, referralCode: { $ne: null } } },
      { $group: { _id: "$referralCode", count: { $sum: 1 } } },
    ]),
    Registration.aggregate([
      { $match: { club: clubObjId, status: "rejected", referralCode: { $ne: null } } },
      { $group: { _id: "$referralCode", count: { $sum: 1 } } },
    ]),
    Registration.aggregate([
      { $match: { club: clubObjId, status: "approved", referralCode: { $ne: null } } },
      { $group: { _id: "$referralCode", total: { $sum: "$amount" } } },
    ]),
  ]);

  const approvedMap = Object.fromEntries(approvedAgg.map((a) => [a._id, a.count]));
  const pendingMap = Object.fromEntries(pendingAgg.map((p) => [p._id, p.count]));
  const rejectedMap = Object.fromEntries(rejectedAgg.map((r) => [r._id, r.count]));
  const revenueMap = Object.fromEntries(revenueAgg.map((v) => [v._id, v.total]));

  for (const m of members) {
    const code = m.code;
    const name = m.name;
    const approved = approvedMap[code] || 0;
    const pending = pendingMap[code] || 0;
    const rejected = rejectedMap[code] || 0;
    const total = approved + pending + rejected;
    const revenue = revenueMap[code] || 0;

    const row = [code, name, approved, pending, rejected, total, revenue];
    await writeChunk(res, formatCsvRow(row));
  }

  res.end();
}

/**
 * Streams payment reconciliation ledger as CSV.
 */
export async function streamPaymentReconciliationCsv({ auth, query, res }) {
  if (auth.role !== "club" && auth.role !== "admin" && auth.role !== "platform_admin") {
    throw new ForbiddenError("Club admin access required for payment reconciliation export");
  }

  const filter = await buildExportFilter(auth, query, "all");

  await writeChunk(res, CSV_BOM);

  const headers = [
    "Registration ID",
    "Participant Name",
    "Email",
    "Phone",
    "Event",
    "Fee (INR)",
    "Amount Paid (INR)",
    "Payment Status",
    "UTR / Transaction Reference",
    "Payment Proof URL",
    "Referral Code",
    "Status",
    "Reviewed By",
    "Submitted At",
    "Reviewed At",
  ];
  await writeChunk(res, formatCsvRow(headers));

  const cursor = Registration.find(filter)
    .populate("event", "name slug fee")
    .sort({ createdAt: -1 })
    .lean()
    .cursor();

  for await (const reg of cursor) {
    const regId = reg.regNo || String(reg._id);
    const participantName = reg.studentName || "";
    const email = reg.studentEmail || "";
    const phone = reg.studentPhone || "";
    const eventName = reg.event?.name || "";
    const eventFee = reg.event?.fee ?? 0;
    const amountPaid = reg.amount ?? 0;
    const paymentStatus = getPaymentStatus(reg);
    const utr = reg.utr || "";
    const proofUrl = reg.paymentScreenshot || "";
    const referralCode = reg.referralCode || "Direct";
    const status = reg.status || "pending";
    const reviewedBy = reg.reviewedBy || "";
    const createdAt = reg.createdAt ? new Date(reg.createdAt).toISOString() : "";
    const reviewedAt = reg.updatedAt ? new Date(reg.updatedAt).toISOString() : "";

    const row = [
      regId,
      participantName,
      email,
      phone,
      eventName,
      eventFee,
      amountPaid,
      paymentStatus,
      utr,
      proofUrl,
      referralCode,
      status,
      reviewedBy,
      createdAt,
      reviewedAt,
    ];

    await writeChunk(res, formatCsvRow(row));
  }

  res.end();
}

export default {
  buildExportFilter,
  streamRegistrationsCsv,
  streamReferralPerformanceCsv,
  streamPaymentReconciliationCsv,
};

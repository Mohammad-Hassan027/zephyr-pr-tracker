import mongoose from "mongoose";
import registrationRepository from "../../repositories/registration.repository.js";
import { parsePagination, buildDateFilter } from "../../validators/registration.validators.js";
import { AppError } from "../../utils/errors.js";

export const registrationStatsService = {
  async getPendingQueue({ auth, query }) {
    const filter = { status: "pending" };

    if (auth.clubId) {
      filter.club = auth.clubId;
    }

    if (auth.role === "pr") {
      filter.referralCode = auth.code;
    } else if (query.code) {
      filter.referralCode = String(query.code).toUpperCase();
    }

    if (query.event) {
      const evFilter = { slug: String(query.event).trim() };
      if (auth.clubId) evFilter.club = auth.clubId;
      const ev = await registrationRepository.findEventBySlugAndClub(
        evFilter.slug,
        auth.clubId
      );
      if (!ev) {
        return {
          items: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }
      filter.event = ev._id;
    }

    if (query.college) {
      filter.college = { $regex: String(query.college).trim(), $options: "i" };
    }

    const dateFilter = buildDateFilter(query.from, query.to);
    if (dateFilter) {
      filter.createdAt = dateFilter;
    }

    const { page, limit, skip } = parsePagination(query);

    const { total, items } = await registrationRepository.findPaginatedQueue(filter, {
      skip,
      limit,
      populate: "event",
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },

  async getStatsSummary(auth) {
    const clubId = auth.clubId;
    const clubObjId = new mongoose.Types.ObjectId(String(clubId));

    const events = await registrationRepository.findEventsByClub(clubId);
    const approvedCounts = await registrationRepository.aggregate([
      { $match: { status: "approved", club: clubObjId } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);

    const countsMap = Object.fromEntries(
      approvedCounts.map((item) => [String(item._id), item.count])
    );

    const stats = events.map((ev) => ({
      eventId: ev._id,
      name: ev.name,
      slug: ev.slug,
      capacity: ev.capacity,
      count: countsMap[String(ev._id)] || 0,
    }));

    stats.sort((a, b) => b.count - a.count);
    return stats;
  },

  async getLeaderboard(auth) {
    const clubId = auth.clubId;
    const clubObjId = new mongoose.Types.ObjectId(String(clubId));

    const leaderboard = await registrationRepository.aggregate([
      { $match: { status: "approved", referralCode: { $ne: null }, club: clubObjId } },
      { $group: { _id: "$referralCode", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const members = await registrationRepository.findPRMembersByClub(clubId);
    const counts = Object.fromEntries(leaderboard.map((l) => [l._id, l.count]));
    const full = members
      .map((m) => ({ name: m.name, code: m.code, count: counts[m.code] || 0 }))
      .sort((a, b) => b.count - a.count);

    return full;
  },

  async getMemberStats({ auth, query }) {
    const code =
      auth.role === "pr"
        ? auth.code
        : query.code
        ? String(query.code).toUpperCase()
        : null;

    if (!code) {
      throw new AppError("Referral code required", 400);
    }

    const filter = { referralCode: code };
    if (auth.clubId) {
      filter.club = auth.clubId;
    }

    const [totalApproved, totalPending, totalRejected, revenueAgg, referrals] =
      await Promise.all([
        registrationRepository.countDocuments({ ...filter, status: "approved" }),
        registrationRepository.countDocuments({ ...filter, status: "pending" }),
        registrationRepository.countDocuments({ ...filter, status: "rejected" }),
        registrationRepository.aggregate([
          { $match: { ...filter, status: "approved" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        registrationRepository.findWithFilter(filter, {
          populate: "event",
          sort: { createdAt: -1 },
          limit: 100,
        }),
      ]);

    const totalRevenue = revenueAgg[0]?.total || 0;

    return {
      code,
      totalApproved,
      totalPending,
      totalRejected,
      totalRevenue,
      referrals: referrals.map((r) => ({
        id: r._id,
        regNo: r.regNo || null,
        studentName: r.studentName,
        studentEmail: r.studentEmail,
        studentPhone: r.studentPhone,
        college: r.college,
        amount: r.amount,
        utr: r.utr || "",
        status: r.status,
        rejectionReason: r.rejectionReason,
        event: r.event,
        createdAt: r.createdAt,
      })),
    };
  },

  async getAuditLog({ auth, query }) {
    const clubId = auth.clubId;
    const filter = {
      status: { $in: ["approved", "rejected"] },
      club: clubId,
    };

    if (query.status && ["approved", "rejected"].includes(query.status)) {
      filter.status = query.status;
    }

    if (query.reviewer) {
      filter.reviewedBy = { $regex: String(query.reviewer).trim(), $options: "i" };
    }

    const dateFilter = buildDateFilter(query.from, query.to);
    if (dateFilter) {
      filter.updatedAt = dateFilter;
    }

    const { page, limit, skip } = parsePagination(query);

    const { total, items } = await registrationRepository.findPaginatedAudit(filter, {
      skip,
      limit,
    });

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  },
};

export default registrationStatsService;

import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import Club from "../models/Club.js";
import PRMember from "../models/PRMember.js";
import { nextSequence } from "../models/Counter.js";

export const registrationRepository = {
  async findClubBySlug(slug) {
    if (!slug) return null;
    return Club.findOne({ slug: String(slug).trim().toLowerCase() });
  },

  async findClubById(clubId) {
    if (!clubId) return null;
    return Club.findById(clubId);
  },

  async findEventBySlugAndClub(eventSlug, clubId) {
    if (!eventSlug || !clubId) return null;
    return Event.findOne({ slug: String(eventSlug).trim(), club: clubId });
  },

  async findEventById(eventId, session = null) {
    if (!eventId) return null;
    const query = Event.findById(eventId);
    if (session) query.session(session);
    return query;
  },

  async findEventsByClub(clubId) {
    return Event.find({ club: clubId }).sort({ date: 1 });
  },

  async findPRMemberByCodeAndClub(code, clubId) {
    if (!code || !clubId) return null;
    return PRMember.findOne({
      code: String(code).toUpperCase(),
      club: clubId,
    });
  },

  async findPRMembersByClub(clubId) {
    return PRMember.find({ club: clubId });
  },

  /**
   * Atomically reserve one capacity slot for an event.
   *
   * Uses a single findOneAndUpdate with a conditional filter so that the check
   * and increment are a single atomic operation — eliminating the read-then-write
   * TOCTOU race that would exist with a separate count query + update.
   *
   * Filter passes only when:
   *   - capacity is null (unlimited), OR
   *   - approvedCount is strictly less than capacity
   *
   * @param {string|ObjectId} eventId
   * @param {mongoose.ClientSession|null} session
   * @returns {Promise<Event|null>} Updated event document, or null if event is full / not found
   */
  async reserveEventCapacity(eventId, session = null) {
    if (!eventId) return null;
    const queryOptions = { new: true };
    if (session) queryOptions.session = session;

    return Event.findOneAndUpdate(
      {
        _id: eventId,
        // Passes when unlimited OR still has space
        $or: [{ capacity: null }, { $expr: { $lt: ["$approvedCount", "$capacity"] } }],
      },
      { $inc: { approvedCount: 1 } },
      queryOptions
    );
  },

  /**
   * Atomically release one capacity slot for an event.
   *
   * Idempotent: the filter requires approvedCount > 0 so the counter cannot go
   * negative. If the event has no capacity set (unlimited) or approvedCount is
   * already 0, the update simply matches zero documents — no error is thrown.
   *
   * @param {string|ObjectId} eventId
   * @param {mongoose.ClientSession|null} session
   * @returns {Promise<Event|null>} Updated event document, or null if already at 0
   */
  async releaseEventCapacity(eventId, session = null) {
    if (!eventId) return null;
    const queryOptions = { new: true };
    if (session) queryOptions.session = session;

    return Event.findOneAndUpdate(
      {
        _id: eventId,
        approvedCount: { $gt: 0 }, // Idempotency guard: never go negative
      },
      { $inc: { approvedCount: -1 } },
      queryOptions
    );
  },

  /**
   * Returns current capacity info for an event.
   * Used by the UI to show remaining seats and the admin consistency check.
   *
   * @param {string|ObjectId} eventId
   * @returns {Promise<{capacity: number|null, approvedCount: number, remaining: number|null, isFull: boolean}|null>}
   */
  async getEventCapacityInfo(eventId) {
    if (!eventId) return null;
    const event = await Event.findById(eventId).select("capacity approvedCount").lean();
    if (!event) return null;
    const remaining =
      event.capacity === null ? null : Math.max(0, event.capacity - event.approvedCount);
    return {
      capacity: event.capacity,
      approvedCount: event.approvedCount,
      remaining,
      isFull: event.capacity !== null && event.approvedCount >= event.capacity,
    };
  },

  async countApprovedRegistrationsForEvent(eventId, session = null) {
    const query = Registration.countDocuments({ event: eventId, status: "approved" });
    if (session) query.session(session);
    return query;
  },

  async findRegistrationByEventAndEmail(eventId, studentEmail) {
    if (!eventId || !studentEmail) return null;
    return Registration.findOne({
      event: eventId,
      studentEmail: String(studentEmail).trim().toLowerCase(),
    });
  },

  async createRegistration(data, session = null) {
    if (session) {
      const [registration] = await Registration.create([data], { session });
      return registration;
    }
    return Registration.create(data);
  },

  async findRegistrationById(id, { populate = true, session = null } = {}) {
    let query = Registration.findById(id);
    if (populate) {
      query = query
        .populate("event", "name slug date venue fee description capacity approvedCount")
        .populate("club", "name slug email");
    }
    if (session) {
      query = query.session(session);
    }
    return query;
  },

  async findRegistrationsByFilter(filter, { populate = true } = {}) {
    let query = Registration.find(filter);
    if (populate) {
      query = query
        .populate("event", "name slug date venue fee description capacity approvedCount")
        .populate("club", "name slug email");
    }
    return query.sort({ createdAt: -1 }).lean();
  },

  async findPaginatedQueue(filter, { skip, limit, populate = "event" } = {}) {
    const [total, items] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.find(filter)
        .populate(populate, "name slug venue fee date capacity approvedCount")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { total, items };
  },

  async findPaginatedAudit(filter, { skip, limit } = {}) {
    const [total, items] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.find(filter)
        .populate("event", "name slug venue fee date")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return { total, items };
  },

  async aggregate(pipeline) {
    return Registration.aggregate(pipeline);
  },

  async countDocuments(filter) {
    return Registration.countDocuments(filter);
  },

  async findWithFilter(filter, { populate = null, sort = null, limit = null } = {}) {
    let query = Registration.find(filter);
    if (populate) {
      query = query.populate(populate, "name slug venue fee date");
    }
    if (sort) {
      query = query.sort(sort);
    }
    if (limit) {
      query = query.limit(limit);
    }
    return query.lean();
  },

  async getNextRegistrationSequence(session = null) {
    const seq = await nextSequence("regNo", session);
    return `REG-${String(seq).padStart(4, "0")}`;
  },
};

export default registrationRepository;

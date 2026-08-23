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
        .populate("event", "name slug date venue fee description")
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
        .populate("event", "name slug date venue fee description")
        .populate("club", "name slug email");
    }
    return query.sort({ createdAt: -1 }).lean();
  },

  async findPaginatedQueue(filter, { skip, limit, populate = "event" } = {}) {
    const [total, items] = await Promise.all([
      Registration.countDocuments(filter),
      Registration.find(filter)
        .populate(populate, "name slug venue fee date")
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

import { Router } from "express";
import Event from "../models/Event.js";
import Club from "../models/Club.js";
import { requireClub } from "../utils/auth.js";
import { optionalAuthenticate } from "../middleware/authenticate.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../utils/errors.js";
import {
  isEventPubliclyVisible,
  isEventRegistrationOpen,
  isEventExpired,
} from "../utils/event-lifecycle.js";

const router = Router();

// GET /api/events - list events
// Public requests: strictly open, non-expired, dated, non-demo events.
// Authenticated club/admin requests: full lifecycle management view.
router.get("/", optionalAuthenticate, async (req, res, next) => {
  try {
    const isAuthenticated = Boolean(req.auth?.clubId || req.auth?.role === "platform_admin");
    const now = new Date();
    const filter = {};

    if (req.query.club) {
      const clubSlug = String(req.query.club).trim().toLowerCase();
      const clubFilter = { slug: clubSlug };
      if (!isAuthenticated) {
        clubFilter.status = "approved";
      }
      const club = await Club.findOne(clubFilter);
      if (!club) return res.json([]);
      filter.club = club._id;
    } else if (req.auth?.clubId) {
      filter.club = req.auth.clubId;
    }

    if (!isAuthenticated) {
      // Public view enforcement:
      // 1. Exclude draft, closed, completed
      filter.status = "open";
      // 2. Exclude missing or past dates
      filter.date = { $exists: true, $ne: null, $gt: now };
    } else {
      // Authenticated management view:
      if (req.query.status) {
        const queryStatus = String(req.query.status).trim().toLowerCase();
        if (["draft", "open", "closed", "completed"].includes(queryStatus)) {
          filter.status = queryStatus;
        }
      }
      if (req.query.includeExpired === "false") {
        filter.date = { $gt: now };
      }
    }

    const events = await Event.find(filter).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:slug - single event by slug
router.get("/:slug", optionalAuthenticate, async (req, res, next) => {
  try {
    const isAuthenticated = Boolean(req.auth?.clubId || req.auth?.role === "platform_admin");
    const filter = { slug: String(req.params.slug).trim().toLowerCase() };

    if (req.query.club) {
      const clubSlug = String(req.query.club).trim().toLowerCase();
      const clubFilter = { slug: clubSlug };
      if (!isAuthenticated) {
        clubFilter.status = "approved";
      }
      const club = await Club.findOne(clubFilter);
      if (!club) throw new NotFoundError("Event not found");
      filter.club = club._id;
    } else if (req.auth?.clubId) {
      filter.club = req.auth.clubId;
    }

    const event = await Event.findOne(filter);
    if (!event) throw new NotFoundError("Event not found");

    if (!isAuthenticated) {
      // Public visibility check: reject draft, closed, completed, or expired events
      if (!isEventPubliclyVisible(event)) {
        throw new NotFoundError("Event not found");
      }
    }

    res.json(event);
  } catch (err) {
    next(err);
  }
});

// POST /api/events - create event (club admin required)
router.post("/", requireClub, async (req, res, next) => {
  try {
    const { name, slug, description, venue, fee, date, capacity, status } = req.body;
    if (!name || !slug) {
      throw new BadRequestError("Name and slug are required");
    }

    const clubId = req.auth.clubId;
    if (!clubId) {
      throw new ForbiddenError("Club association required");
    }

    let initialStatus = "open";
    if (status) {
      const normStatus = String(status).trim().toLowerCase();
      if (!["draft", "open", "closed", "completed"].includes(normStatus)) {
        throw new BadRequestError("Invalid status. Allowed: draft, open, closed, completed");
      }
      initialStatus = normStatus;
    }

    const event = await Event.create({
      name,
      slug: String(slug).trim().toLowerCase(),
      description: description ? String(description).trim() : "",
      venue: venue ? String(venue).trim() : "",
      fee: fee ? Number(fee) : 0,
      date: date ? new Date(date) : undefined,
      capacity: capacity ? Number(capacity) : null,
      status: initialStatus,
      club: clubId,
    });
    res.status(201).json(event);
  } catch (err) {
    if (err.code === 11000) {
      return next(new ConflictError("An event with this slug already exists in your club"));
    }
    next(err);
  }
});

// PUT /api/events/:id - update event (club admin required)
router.put("/:id", requireClub, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, venue, fee, date, capacity, status } = req.body;

    const event = await Event.findOne({ _id: id, club: req.auth.clubId });
    if (!event) {
      throw new NotFoundError("Event not found");
    }

    if (name) event.name = String(name).trim();
    if (description !== undefined) event.description = String(description).trim();
    if (venue !== undefined) event.venue = String(venue).trim();
    if (fee !== undefined) event.fee = Number(fee) || 0;
    if (date !== undefined) event.date = date ? new Date(date) : undefined;
    if (capacity !== undefined) event.capacity = capacity ? Number(capacity) : null;
    if (status !== undefined) {
      const normStatus = String(status).trim().toLowerCase();
      if (!["draft", "open", "closed", "completed"].includes(normStatus)) {
        throw new BadRequestError("Invalid status. Allowed: draft, open, closed, completed");
      }
      event.status = normStatus;
    }

    await event.save();
    return res.json(event);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/events/:id/status - update event lifecycle status (club admin required)
router.patch("/:id/status", requireClub, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      throw new BadRequestError("Status is required");
    }
    const normStatus = String(status).trim().toLowerCase();
    if (!["draft", "open", "closed", "completed"].includes(normStatus)) {
      throw new BadRequestError("Invalid status. Allowed: draft, open, closed, completed");
    }

    const event = await Event.findOne({ _id: id, club: req.auth.clubId });
    if (!event) {
      throw new NotFoundError("Event not found");
    }

    event.status = normStatus;
    await event.save();
    return res.json(event);
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/close - close event registrations (club admin required)
router.post("/:id/close", requireClub, async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, club: req.auth.clubId });
    if (!event) throw new NotFoundError("Event not found");

    event.status = "closed";
    await event.save();
    return res.json({ ok: true, message: "Event registration closed", event });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/complete - mark event completed (club admin required)
router.post("/:id/complete", requireClub, async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, club: req.auth.clubId });
    if (!event) throw new NotFoundError("Event not found");

    event.status = "completed";
    await event.save();
    return res.json({ ok: true, message: "Event marked as completed", event });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/reopen - reopen event registration (club admin required)
router.post("/:id/reopen", requireClub, async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, club: req.auth.clubId });
    if (!event) throw new NotFoundError("Event not found");

    event.status = "open";
    await event.save();
    return res.json({ ok: true, message: "Event reopened", event });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id - delete event (club admin required)
router.delete("/:id", requireClub, async (req, res, next) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, club: req.auth.clubId });
    if (!event) {
      throw new NotFoundError("Event not found");
    }

    await Event.deleteOne({ _id: id, club: req.auth.clubId });
    return res.json({ ok: true, message: "Event deleted successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;

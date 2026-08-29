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

const router = Router();

// GET /api/events - list events, optionally scoped by ?club=slug or by session token
router.get("/", optionalAuthenticate, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.club) {
      const clubSlug = String(req.query.club).trim().toLowerCase();
      const club = await Club.findOne({ slug: clubSlug });
      if (!club) return res.json([]);
      filter.club = club._id;
    } else if (req.auth?.clubId) {
      filter.club = req.auth.clubId;
    }

    const events = await Event.find(filter).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:slug - single event by slug (optionally scoped by ?club=slug)
router.get("/:slug", async (req, res, next) => {
  try {
    const filter = { slug: req.params.slug };
    if (req.query.club) {
      const club = await Club.findOne({ slug: String(req.query.club).trim().toLowerCase() });
      if (!club) throw new NotFoundError("Event not found");
      filter.club = club._id;
    }
    const event = await Event.findOne(filter);
    if (!event) throw new NotFoundError("Event not found");
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// POST /api/events - create event (club admin required)
router.post("/", requireClub, async (req, res, next) => {
  try {
    const { name, slug, description, venue, fee, date, capacity } = req.body;
    if (!name || !slug) {
      throw new BadRequestError("Name and slug are required");
    }

    const clubId = req.auth.clubId;
    if (!clubId) {
      throw new ForbiddenError("Club association required");
    }

    const event = await Event.create({
      name,
      slug: String(slug).trim().toLowerCase(),
      description: description ? String(description).trim() : "",
      venue: venue ? String(venue).trim() : "",
      fee: fee ? Number(fee) : 0,
      date,
      capacity: capacity ? Number(capacity) : null,
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
    const { name, description, venue, fee, date, capacity } = req.body;

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

    await event.save();
    return res.json(event);
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

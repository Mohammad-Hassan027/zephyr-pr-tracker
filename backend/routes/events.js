import { Router } from "express";
import Event from "../models/Event.js";
import Club from "../models/Club.js";
import { requireClub, verifySessionToken } from "../utils/auth.js";

const router = Router();

// GET /api/events - list events, optionally scoped by ?club=slug or by session token
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.club) {
      const clubSlug = String(req.query.club).trim().toLowerCase();
      const club = await Club.findOne({ slug: clubSlug });
      if (!club) return res.json([]);
      filter.club = club._id;
    } else {
      const authHeader = req.get("authorization");
      if (authHeader) {
        const token = authHeader.split(" ")[1];
        try {
          const session = verifySessionToken(token);
          if (session.clubId) {
            filter.club = session.clubId;
          }
        } catch (_e) {
          // ignore error if unauthenticated
        }
      }
    }

    const events = await Event.find(filter).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:slug - single event by slug (optionally scoped by ?club=slug)
router.get("/:slug", async (req, res) => {
  try {
    const filter = { slug: req.params.slug };
    if (req.query.club) {
      const club = await Club.findOne({ slug: String(req.query.club).trim().toLowerCase() });
      if (!club) return res.status(404).json({ error: "Event not found" });
      filter.club = club._id;
    }
    const event = await Event.findOne(filter);
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events - create event (club admin required)
router.post("/", requireClub, async (req, res) => {
  try {
    const { name, slug, description, venue, fee, date, capacity } = req.body;
    if (!name || !slug) {
      return res.status(400).json({ error: "Name and slug are required" });
    }

    const clubId = req.auth.clubId;
    if (!clubId) {
      return res.status(403).json({ error: "Club association required" });
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
      return res.status(400).json({ error: "An event with this slug already exists in your club" });
    }
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/events/:id - update event (club admin required)
router.put("/:id", requireClub, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, venue, fee, date, capacity } = req.body;

    const event = await Event.findOne({ _id: id, club: req.auth.clubId });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
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
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/events/:id - delete event (club admin required)
router.delete("/:id", requireClub, async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, club: req.auth.clubId });
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    await Event.deleteOne({ _id: id, club: req.auth.clubId });
    return res.json({ ok: true, message: "Event deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

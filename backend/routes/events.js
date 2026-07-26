import { Router } from "express";
import Event from "../models/Event.js";

const router = Router();

// GET /api/events - list all events
router.get("/", async (_req, res) => {
  const events = await Event.find().sort({ date: 1 });
  res.json(events);
});

// GET /api/events/:slug - single event by slug
router.get("/:slug", async (req, res) => {
  const event = await Event.findOne({ slug: req.params.slug });
  if (!event) return res.status(404).json({ error: "Event not found" });
  res.json(event);
});

// POST /api/events - create event (PR/admin use)
router.post("/", async (req, res) => {
  try {
    const { name, slug, description, date, capacity } = req.body;
    const event = await Event.create({ name, slug, description, date, capacity });
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

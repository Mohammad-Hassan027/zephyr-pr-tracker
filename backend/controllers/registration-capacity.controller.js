import mongoose from "mongoose";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";

/**
 * GET /api/registrations/capacity/check
 *
 * Admin-only consistency check that compares each event's `approvedCount`
 * counter against the ground-truth count of approved Registration documents.
 *
 * Reports any events where the two values diverge (counter drift) and
 * provides a summary of whether the system is in a consistent state.
 */
export async function checkCapacityConsistency(req, res) {
  try {
    const clubId = req.auth?.clubId;
    const eventFilter = clubId ? { club: new mongoose.Types.ObjectId(String(clubId)) } : {};

    // Load all events for the requesting club
    const events = await Event.find(eventFilter)
      .select("_id name slug capacity approvedCount club")
      .lean();

    if (events.length === 0) {
      return res.json({
        ok: true,
        consistent: true,
        totalEvents: 0,
        driftCount: 0,
        driftedEvents: [],
        message: "No events found for consistency check.",
      });
    }

    const eventIds = events.map((e) => e._id);

    // Aggregate actual approved counts from Registration collection (ground truth)
    const actualCounts = await Registration.aggregate([
      { $match: { event: { $in: eventIds }, status: "approved" } },
      { $group: { _id: "$event", actualApprovedCount: { $sum: 1 } } },
    ]);

    const actualCountMap = Object.fromEntries(
      actualCounts.map((item) => [String(item._id), item.actualApprovedCount])
    );

    // Compare each event's counter against actual count
    const driftedEvents = [];
    for (const ev of events) {
      const actual = actualCountMap[String(ev._id)] ?? 0;
      const counter = ev.approvedCount ?? 0;
      if (actual !== counter) {
        driftedEvents.push({
          eventId: ev._id,
          name: ev.name,
          slug: ev.slug,
          capacity: ev.capacity,
          counterValue: counter,
          actualApprovedCount: actual,
          drift: actual - counter,
        });
      }
    }

    const consistent = driftedEvents.length === 0;

    return res.json({
      ok: true,
      consistent,
      totalEvents: events.length,
      driftCount: driftedEvents.length,
      driftedEvents,
      message: consistent
        ? "All event capacity counters are consistent with approved registration counts."
        : `${driftedEvents.length} event(s) have counter drift. Run POST /capacity/reconcile to fix.`,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

/**
 * POST /api/registrations/capacity/reconcile
 *
 * Admin-only operation that re-syncs the `approvedCount` counter on each
 * event to match the actual count of approved registrations.
 *
 * Idempotent — safe to run repeatedly. Operates with $set so it will
 * converge regardless of current counter value (whether too high or too low).
 */
export async function reconcileCapacityCounters(req, res) {
  try {
    const clubId = req.auth?.clubId;
    const eventFilter = clubId ? { club: new mongoose.Types.ObjectId(String(clubId)) } : {};

    const events = await Event.find(eventFilter).select("_id name slug capacity approvedCount").lean();

    if (events.length === 0) {
      return res.json({
        ok: true,
        reconciled: 0,
        corrected: 0,
        details: [],
        message: "No events found to reconcile.",
      });
    }

    const eventIds = events.map((e) => e._id);

    const actualCounts = await Registration.aggregate([
      { $match: { event: { $in: eventIds }, status: "approved" } },
      { $group: { _id: "$event", actualApprovedCount: { $sum: 1 } } },
    ]);

    const actualCountMap = Object.fromEntries(
      actualCounts.map((item) => [String(item._id), item.actualApprovedCount])
    );

    const corrections = [];
    for (const ev of events) {
      const actual = actualCountMap[String(ev._id)] ?? 0;
      const counter = ev.approvedCount ?? 0;
      if (actual !== counter) {
        await Event.findByIdAndUpdate(ev._id, { $set: { approvedCount: actual } });
        corrections.push({
          eventId: ev._id,
          name: ev.name,
          slug: ev.slug,
          before: counter,
          after: actual,
          drift: actual - counter,
        });
      }
    }

    return res.json({
      ok: true,
      reconciled: events.length,
      corrected: corrections.length,
      details: corrections,
      message:
        corrections.length === 0
          ? "All counters were already consistent. No changes made."
          : `Reconciled ${corrections.length} event counter(s) to match actual approved registration counts.`,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

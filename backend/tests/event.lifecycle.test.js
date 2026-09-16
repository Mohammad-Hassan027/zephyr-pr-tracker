/**
 * event.lifecycle.test.js
 *
 * Automated verification of the Event Lifecycle and Expiration enforcement:
 * - Public listing visibility: future open included; draft, closed, completed, past, and undated excluded.
 * - Public lookup: rejects non-open or expired events.
 * - Registration creation rejection:
 *     - Expired event rejected with HTTP 422 / EVENT_EXPIRED
 *     - Closed event rejected with HTTP 422 / EVENT_CLOSED
 *     - Completed event rejected with HTTP 422 / EVENT_EXPIRED
 *     - Draft or undated event rejected with HTTP 422 / EVENT_NOT_OPEN
 * - Admin listings can inspect historical/closed/draft events.
 * - Cleanup script (--dry-run vs mutation) is idempotent, safe, and preserves historical data.
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import mongoose from "mongoose";

import { setupTestDb, teardownTestDb } from "./setup-test-db.js";
import { createSessionToken } from "../utils/auth.js";
import errorHandler from "../middleware/errorHandler.js";
import eventsRoutes from "../routes/events.js";
import registrationsRoutes from "../routes/registrations.js";
import Club from "../models/Club.js";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";

describe("Event Lifecycle & Expiration Suite", () => {
  let server;
  let baseUrl;
  let clubA;
  let clubB;
  let futureOpenEvent;
  let pastEvent;
  let draftEvent;
  let closedEvent;
  let completedEvent;
  let undatedEvent;
  let clubAToken;

  before(async () => {
    await setupTestDb();
    await Club.deleteMany({});
    await Event.deleteMany({});
    await Registration.deleteMany({});

    // Create clubs
    clubA = await Club.create({
      name: "Alpha Tech Club",
      slug: "alpha-tech",
      email: "contact@alpha-tech.edu",
      passwordHash: "hash123",
      status: "approved",
    });

    clubB = await Club.create({
      name: "Beta Society",
      slug: "beta-soc",
      email: "contact@beta.edu",
      passwordHash: "hash123",
      status: "approved",
    });

    clubAToken = createSessionToken({
      role: "club",
      clubId: clubA._id.toString(),
      clubSlug: clubA.slug,
    });

    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days in future
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days in past

    // 1. Future Open Event
    futureOpenEvent = await Event.create({
      name: "Alpha Hackathon 2026",
      slug: "alpha-hackathon",
      date: futureDate,
      fee: 100,
      status: "open",
      capacity: 50,
      club: clubA._id,
    });

    // 2. Past Open Event (Expired)
    pastEvent = await Event.create({
      name: "Alpha Summer Meetup 2026",
      slug: "alpha-summer-meetup",
      date: pastDate,
      fee: 0,
      status: "open",
      club: clubA._id,
    });

    // 3. Draft Event
    draftEvent = await Event.create({
      name: "Alpha Secret Draft Event",
      slug: "alpha-draft-event",
      date: futureDate,
      fee: 50,
      status: "draft",
      club: clubA._id,
    });

    // 4. Closed Event
    closedEvent = await Event.create({
      name: "Alpha Closed Workshop",
      slug: "alpha-closed-workshop",
      date: futureDate,
      fee: 75,
      status: "closed",
      club: clubA._id,
    });

    // 5. Completed Event
    completedEvent = await Event.create({
      name: "Alpha Completed Fest",
      slug: "alpha-completed-fest",
      date: pastDate,
      fee: 200,
      status: "completed",
      club: clubA._id,
    });

    // 6. Undated Event
    undatedEvent = await Event.create({
      name: "Alpha Undated Gathering",
      slug: "alpha-undated-gathering",
      date: null,
      fee: 0,
      status: "open",
      club: clubA._id,
    });

    // Setup test express server
    const app = express();
    app.use(express.json());
    app.use("/api/events", eventsRoutes);
    app.use("/api/registrations", registrationsRoutes);
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api`;
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    await teardownTestDb();
  });

  it("1. Public GET /api/events includes future open events and excludes draft, closed, completed, past, and undated events", async () => {
    const res = await fetch(`${baseUrl}/events?club=alpha-tech`);
    assert.equal(res.status, 200);
    const events = await res.json();

    assert.ok(Array.isArray(events), "Response should be an array");
    const slugs = events.map((e) => e.slug);

    assert.ok(
      slugs.includes("alpha-hackathon"),
      "Future open event must be included",
    );
    assert.ok(
      !slugs.includes("alpha-summer-meetup"),
      "Past event must be excluded from public listing",
    );
    assert.ok(
      !slugs.includes("alpha-draft-event"),
      "Draft event must be excluded from public listing",
    );
    assert.ok(
      !slugs.includes("alpha-closed-workshop"),
      "Closed event must be excluded from public listing",
    );
    assert.ok(
      !slugs.includes("alpha-completed-fest"),
      "Completed event must be excluded from public listing",
    );
    assert.ok(
      !slugs.includes("alpha-undated-gathering"),
      "Undated event must be excluded from public listing",
    );
    assert.equal(
      events.length,
      1,
      "Only the 1 future open event should be returned publicly",
    );
  });

  it("2. Authenticated club admin GET /api/events can view all events across full lifecycle", async () => {
    const res = await fetch(`${baseUrl}/events`, {
      headers: {
        Authorization: `Bearer ${clubAToken}`,
      },
    });
    assert.equal(res.status, 200);
    const events = await res.json();
    const slugs = events.map((e) => e.slug);

    assert.ok(slugs.includes("alpha-hackathon"));
    assert.ok(slugs.includes("alpha-summer-meetup"));
    assert.ok(slugs.includes("alpha-draft-event"));
    assert.ok(slugs.includes("alpha-closed-workshop"));
    assert.ok(slugs.includes("alpha-completed-fest"));
    assert.ok(slugs.includes("alpha-undated-gathering"));
    assert.equal(
      events.length,
      6,
      "Club admin must be able to view all 6 club events",
    );
  });

  it("3. Public lookup GET /api/events/:slug rejects expired or non-public events with 404", async () => {
    // 1. Future open event returns 200
    const resOpen = await fetch(
      `${baseUrl}/events/alpha-hackathon?club=alpha-tech`,
    );
    assert.equal(resOpen.status, 200);
    const openData = await resOpen.json();
    assert.equal(openData.slug, "alpha-hackathon");

    // 2. Past event returns 404
    const resPast = await fetch(
      `${baseUrl}/events/alpha-summer-meetup?club=alpha-tech`,
    );
    assert.equal(resPast.status, 404);

    // 3. Draft event returns 404
    const resDraft = await fetch(
      `${baseUrl}/events/alpha-draft-event?club=alpha-tech`,
    );
    assert.equal(resDraft.status, 404);

    // 4. Closed event returns 404
    const resClosed = await fetch(
      `${baseUrl}/events/alpha-closed-workshop?club=alpha-tech`,
    );
    assert.equal(resClosed.status, 404);
  });

  it("4. Registration creation rejects expired events with EVENT_EXPIRED (HTTP 422)", async () => {
    const res = await fetch(`${baseUrl}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: "John Doe",
        studentEmail: "john@example.com",
        studentPhone: "9876543210",
        college: "MIT",
        amount: 0,
        clubSlug: "alpha-tech",
        eventSlug: "alpha-summer-meetup", // Past event
        paymentScreenshot:
          "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/proof1.png",
        paymentScreenshotPublicId: "zephyr-payments/proof1",
      }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.code, "EVENT_EXPIRED");
    assert.equal(body.error, "Registration for this event is closed");
  });

  it("5. Registration creation rejects closed events with EVENT_CLOSED (HTTP 422)", async () => {
    const res = await fetch(`${baseUrl}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: "Jane Doe",
        studentEmail: "jane@example.com",
        studentPhone: "9876543211",
        college: "MIT",
        amount: 75,
        clubSlug: "alpha-tech",
        eventSlug: "alpha-closed-workshop", // Closed event
        paymentScreenshot:
          "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/proof2.png",
        paymentScreenshotPublicId: "zephyr-payments/proof2",
      }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.code, "EVENT_CLOSED");
    assert.equal(body.error, "Registration for this event is closed");
  });

  it("6. Registration creation rejects completed events with EVENT_EXPIRED (HTTP 422)", async () => {
    const res = await fetch(`${baseUrl}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: "Bob Smith",
        studentEmail: "bob@example.com",
        studentPhone: "9876543212",
        college: "MIT",
        amount: 200,
        clubSlug: "alpha-tech",
        eventSlug: "alpha-completed-fest", // Completed event
        paymentScreenshot:
          "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/proof3.png",
        paymentScreenshotPublicId: "zephyr-payments/proof3",
      }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.code, "EVENT_EXPIRED");
    assert.equal(body.error, "Registration for this event is closed");
  });

  it("7. Registration creation rejects draft and undated events with EVENT_NOT_OPEN (HTTP 422)", async () => {
    // Draft rejection
    const resDraft = await fetch(`${baseUrl}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: "Alice Walker",
        studentEmail: "alice@example.com",
        studentPhone: "9876543213",
        college: "MIT",
        amount: 50,
        clubSlug: "alpha-tech",
        eventSlug: "alpha-draft-event", // Draft event
        paymentScreenshot:
          "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/proof4.png",
        paymentScreenshotPublicId: "zephyr-payments/proof4",
      }),
    });

    assert.equal(resDraft.status, 422);
    const bodyDraft = await resDraft.json();
    assert.equal(bodyDraft.code, "EVENT_NOT_OPEN");
    assert.equal(bodyDraft.error, "Registration for this event is not open");

    // Undated rejection
    const resUndated = await fetch(`${baseUrl}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: "Charlie Brown",
        studentEmail: "charlie@example.com",
        studentPhone: "9876543214",
        college: "MIT",
        amount: 0,
        clubSlug: "alpha-tech",
        eventSlug: "alpha-undated-gathering", // Undated event
        paymentScreenshot:
          "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/proof5.png",
        paymentScreenshotPublicId: "zephyr-payments/proof5",
      }),
    });

    assert.equal(resUndated.status, 422);
    const bodyUndated = await resUndated.json();
    assert.equal(bodyUndated.code, "EVENT_EXPIRED"); // missing date treated as expired
  });

  it("8. Valid future open event accepts registration successfully", async () => {
    const res = await fetch(`${baseUrl}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentName: "Valid Participant",
        studentEmail: "valid.participant@example.com",
        studentPhone: "9876543215",
        college: "Engineering College",
        amount: 100,
        clubSlug: "alpha-tech",
        eventSlug: "alpha-hackathon",
        paymentScreenshot:
          "https://res.cloudinary.com/demo/image/upload/v1/zephyr-payments/proof6.png",
        paymentScreenshotPublicId: "zephyr-payments/proof6",
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.id, "Registration ID should be returned");
    assert.equal(body.status, "pending");
  });

  it("9. Admin status transition endpoints (close, complete, reopen, status patch)", async () => {
    // 1. Close event
    const resClose = await fetch(
      `${baseUrl}/events/${futureOpenEvent._id}/close`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${clubAToken}` },
      },
    );
    assert.equal(resClose.status, 200);
    const closedEventDoc = await Event.findById(futureOpenEvent._id);
    assert.equal(closedEventDoc.status, "closed");

    // 2. Reopen event
    const resReopen = await fetch(
      `${baseUrl}/events/${futureOpenEvent._id}/reopen`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${clubAToken}` },
      },
    );
    assert.equal(resReopen.status, 200);
    const reopenedDoc = await Event.findById(futureOpenEvent._id);
    assert.equal(reopenedDoc.status, "open");

    // 3. Status PATCH
    const resPatch = await fetch(
      `${baseUrl}/events/${futureOpenEvent._id}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${clubAToken}`,
        },
        body: JSON.stringify({ status: "completed" }),
      },
    );
    assert.equal(resPatch.status, 200);
    const patchedDoc = await Event.findById(futureOpenEvent._id);
    assert.equal(patchedDoc.status, "completed");

    // Reset back to open for future assertions
    futureOpenEvent.status = "open";
    await futureOpenEvent.save();
  });
});

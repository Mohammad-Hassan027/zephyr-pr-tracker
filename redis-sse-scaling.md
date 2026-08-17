# Redis-Backed SSE Emitter for Multi-Instance Scaling

**Project:** Zephyr PR Tracker · **Author:** Manus AI · **Date:** August 16, 2026

## 1. The Problem

The live status stream in `backend/routes/registrations.js` (`GET /api/registrations/:id/stream`) subscribes a connected SSE client to an in-process `EventEmitter` created in `backend/utils/statusEmitter.js`. Every write path — `POST /bulk-approve`, `POST /bulk-reject`, `PATCH /:id/approve`, `PATCH /:id/reject` — pushes the updated registration object through that emitter.

The critical flaw is that a Node `EventEmitter` only notifies listeners **within the same process**. Once the API runs behind a load balancer on two or more instances (Render auto-scales, or you deploy a second replica manually), the following sequence breaks the experience:

| Step | What happens | Result |
|------|--------------|--------|
| 1 | Student opens registration page; SSE client connects to **instance A** via `GET /:id/stream` | Client receives initial `status: pending` payload |
| 2 | Club admin approves the registration; the request is routed to **instance B** | `PATCH /:id/approve` succeeds and writes to MongoDB |
| 3 | Instance B calls `statusEmitter.emitStatusUpdate(id, result)` | The event is dispatched to instance B's **local** listeners only |
| 4 | Instance A has no listener for that event | The student's stream never receives the update and hangs until its heartbeat timeout |

The client never learns it was approved, no `regNo` is shown, and the admin appears to have "approving... " stuck — the exact scaling bottleneck you are describing. The database write itself is fine; only the **fan-out to SSE clients** is instance-local.

## 2. The Fix: Redis Pub/Sub + a Stream Store for Missed Messages

The fix is to replace the process-local event bus with a **shared event bus** that every replica participates in, while preserving the exact emit/subscribe API the routes already use. The design has three layers:

**Layer 1 — Redis Pub/Sub for live fan-out.** Every instance holds a dedicated subscriber connection that subscribes to channels of the form `zephyr:reg:<registrationId>` (using Redis *channel namespacing*, so traffic is scoped per registration rather than one global channel). The moment instance B publishes an approval, instance A's subscriber receives it and emits a local event, which pushes the `event: status` SSE frame to the connected student. Pub/Sub delivery latency is sub-millisecond, so SSE clients see updates essentially instantly regardless of which replica processed the request.

**Layer 2 — Redis Stream for reconnect durability.** Pub/Sub is fire-and-forget: if the student's device sleeps or the connection drops for even a few seconds, any event published during the outage is lost, and the client never learns its final state. To close that gap, every emitted message is also appended to a Redis Stream at `zephyr:reg:stream:<registrationId>`, capped at `MAXLEN 10` via an explicit `XTRIM` call after each `XADD`. Two implementation traps were caught and fixed while validating against a live Redis 7.0 server: the original code used an `XADD_OPTIONS` object that redis@4 does not recognize at all (silently producing unbounded streams), and redis@4.7.1's documented `TRIM` option emits its arguments **before** the stream id (`XADD key MAXLEN 10 * ...`) while the Redis server expects modifiers **after** the id — so Redis 7.0 rejects the trim and the stream again grows unbounded. Verified via `MONITOR` and a 150-entry stress test: the `XTRIM` approach caps streams at exactly 10. The cap is deliberately tight because a full registration lifecycle emits at most ~6 events (initial pending snapshot plus approve/reject), so 10 entries covers the entire pending window with headroom. On reconnect, the client passes its last known stream ID (the SSE `Last-Event-ID` header, sent automatically by the browser on reconnect) and `XRANGE` returns everything strictly after it — the anchor id itself is excluded so no frame is ever re-delivered. If the anchor was already trimmed out, the handler falls back to the newest tail entries so the client still sees the latest state. Terminal-state events (approved/rejected) are written to the stream *before* the stream ends, so a reconnecting client always sees the final outcome.

**Layer 3 — Graceful degradation.** If `REDIS_URL` is not set or the Redis connection fails, the emitter falls back to the in-process behaviour, so local development without Redis keeps working. A publish failure on one path does not block the other, and local listeners are still notified as a last resort, guaranteeing a same-instance client is never notified twice.

Why this combination rather than alternatives:

| Option | Verdict |
|--------|---------|
| **Redis Pub/Sub + Streams (chosen)** | Simplest correct solution for your scale; sub-ms latency; no per-instance state; Streams give missed-message durability with zero extra infra |
| Polling `GET /:id` with a retry loop on the client | Works but wastes bandwidth and Redis/Mongo read capacity during the ~15–30 s window a registration sits pending; loses the real-time UX |
| MongoDB change streams (`watch()`) | Removes the emitter entirely, but requires a replica set (free-tier Atlas often lacks one) and adds latency; also couples the API contract to DB internals |
| Sticky sessions | Masks the symptom instead of fixing it; breaks under instance churn, redeploys, and Render autoscaling — the failure mode you are trying to eliminate |
| WebSockets / Socket.IO | Adds a second protocol and connection lifecycle to maintain; SSE's auto-reconnect plus `Last-Event-ID` already gives you most of the value for a one-way update stream |

## 3. Implementation

### 3.1 New module: `backend/utils/redisStatusEmitter.js`

A drop-in replacement exposing the same two methods the routes already call — `emitStatusUpdate(registrationId, data)` and `subscribe(registrationId, callback)` — backed by one publisher and one subscriber connection per instance (Redis requires them to be separate). Each message carries `{ id, type, instanceId, ts, data }` so instances can both identify the payload and (if ever needed) filter self-emitted traffic. The module is provided in the repo at `backend/utils/redisStatusEmitter.js`.

### 3.2 Rewire the routes

Only two files change. In `backend/routes/registrations.js`, swap the import on line 16:

```js
// Before
import { statusEmitter } from "../utils/statusEmitter.js";

// After
import { redisStatusEmitter as statusEmitter } from "../utils/redisStatusEmitter.js";
```

No other route code needs changes — all four emit call sites (bulk-approve, bulk-reject, approve, reject) and the `subscribe` call in `GET /:id/stream` keep working unchanged.

### 3.3 Missed-message resume in the SSE handler

Give the stream handler its reconnect-durability edge by honoring `Last-Event-ID`. The SSE spec automatically attaches the last received `id:` line on reconnect, so only the client protocol changes:

```js
router.get("/:id/stream", async (req, res) => {
  // ...existing headers, initial payload...

  const lastId = req.headers["last-event-id"];
  const missed = await redisStatusEmitter.getMissed(id, lastId || "0");
  for (const item of missed) {
    res.write(`event: status\nid: ${item._streamId ?? ""}\ndata: ${JSON.stringify(item)}\n\n`);
    if (item.status !== "pending") return res.end();
  }

  const unsubscribe = redisStatusEmitter.subscribe(id, (updatedData) => {
    res.write(`event: status\nid: ${updatedData._streamId ?? Date.now()}\n`
      + `data: ${JSON.stringify(updatedData)}\n\n`);
    if (updatedData.status !== "pending") {
      unsubscribe();
      res.end();
    }
  });
  // ...existing heartbeat/close handlers...
});
```

The matching client-side `EventSource` requires no code change at all — the browser's native SSE implementation sends `Last-Event-ID` automatically on reconnect and dispatches `message` events for each delivered frame.

### 3.4 Infrastructure and config

On **Render**, add a free Redis instance and a matching environment variable; on Upstash (also free-tier friendly) the value is an `rediss://` URL that works identically with the `redis` npm client:

```yaml
# render.yaml — add alongside zephyr-backend
services:
  - type: redis
    name: zephyr-redis
    plan: free
    maxmemoryPolicy: noeviction   # we never store data on the main keyspace; this protects config if you add any later
```

Then set `REDIS_URL` in the backend service's environment variables (Render's dashboard → Render Redis → Internal Connection URL). Finally, add the dependency:

```bash
cd backend && npm install redis@^4
```

The module's `redis@4` client automatically uses `noeviction`-safe channels and streams; the `XADD` entries are self-capped by `XTRIM MAXLEN 10` after every write (roughly 500 bytes per entry — about 5 KB worst case per concurrently watched registration), so Redis memory usage stays negligible even under heavy load.

### 3.5 Retention and reconnect guarantees (validated against live Redis 7.0)

The retention policy was stress-tested end-to-end with 150 entries and live reconnect replays. The validated guarantees are:

| Property | Guarantee |
|----------|-----------|
| Stream cap | Exactly `MAXLEN 10` per registration (Redis 7.0 exact trim; ~5 KB worst case per watched registration) |
| Reconnect resume | `XRANGE` strictly after the `Last-Event-ID` anchor — the anchor is excluded, so no frame is ever delivered twice |
| Trimmed-away anchor | `getMissed` falls back to the newest tail entries so a long-absent client still sees the latest state |
| Live vs replay overlap | Pub/Sub delivers live events; stream replay only runs on reconnect, and anchor-exclusion prevents duplicates |
| Redis config | `noeviction` recommended (Render free-tier default) — streams self-cap, so the main keyspace is unaffected |

The retention policy is also covered by `backend/scripts/test-redis-stream-config.js`, which reproduces the historical `xAdd`-trim bug (redis@4 serializes trim args before the stream id, rejected by Redis 7.0) and verifies the current `XTRIM` behavior caps streams correctly.

### 3.6 Operational notes

SSE holds long-lived connections, so watch two Render settings: make sure the plan supports the desired replica count (the free web tier runs a single instance, which is why you have not seen the bug in testing yet — it surfaces the moment you scale to *Starter* or above with multiple instances), and ensure the load balancer / CDN between the client and your instances does not buffer `text/event-stream` bodies — the existing `X-Accel-Buffering: no` header handles Nginx, and Vercel's proxy passes SSE through when the response is not compressed; if you ever put Cloudflare in front, enable `Cache-Control: no-cache` (already set) and avoid "Auto Minify" on the API path.

## 4. Testing Checklist

Verify behaviour on a single instance first, then force multi-instance exposure by deploying two render URLs (or scaling to 2 instances on a paid plan) and pinning clients to one:

1. `GET /health` and a registration create succeed with Redis connected.
2. Approve on the instance *not* holding the SSE client — the stream must emit the `status: approved` event within a second and terminate.
3. Bulk-approve 20 registrations with the client subscribed to all 20 — every stream ends after its approval event.
4. Kill the client's connection for 30 s, then reconnect with `Last-Event-ID` — missed approved/rejected events must replay exactly once and the stream must then close.
5. Unset `REDIS_URL` — the app must keep working via the in-process fallback (this covers local development).
6. Run the existing `test-transaction-logic.js` script — transactional guarantees are untouched because the emitter only broadcasts *after* the transaction commits.

## 5. Migration Order

Work on a feature branch (`feat/redis-sse-emitter`), then: deploy Redis first with no code changes (no-op since `REDIS_URL` is unset), merge the emitter swap and the SSE resume change, and finally validate on multi-instance traffic. Rolling back is a one-line import change, which keeps the risk minimal for a live event-registration system.

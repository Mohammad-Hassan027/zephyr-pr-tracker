import { EventEmitter } from "node:events";
import { createClient } from "redis";
import crypto from "node:crypto";

/**
 * Redis-backed registration status emitter.
 *
 * Why this exists:
 * The in-process EventEmitter works while the API runs on a single instance,
 * but the moment Render auto-scales (or you run multiple replicas), a
 * `POST /bulk-approve` handled by instance B will not reach SSE clients
 * connected to instance A. Redis Pub/Sub gives every instance a shared
 * event bus so all SSE streams are notified regardless of which replica
 * processed the approval.
 *
 * Design:
 *  - Every instance subscribes once per registration id (fan-out):
 *      channel:  zephyr:reg:<registrationId>
 *      payload:  { type, data } as JSON (type "status" for compatibility)
 *  - On emit, the publisher ALSO pushes the message to a Redis Stream
 *      key: zephyr:reg:stream:<registrationId>  (capped at MAXLEN ~100)
 *    so that a reconnecting client can fetch events missed between
 *    disconnect and reconnect (Pub/Sub is fire-and-forget).
 *  - Falls back to the in-process emitter when Redis is unavailable, so
 *    local development without Redis keeps working (degraded to
 *    single-instance behaviour).
 */

const CHANNEL_PREFIX = "zephyr:reg:";
const STREAM_PREFIX = "zephyr:reg:stream:";
// Per-registration streams are capped aggressively: a full registration
// lifecycle (pending updates + approve/reject) emits at most ~6 events.
// MAXLEN 10 keeps memory bounded (~10 x ~500 bytes per watched registration)
// while still covering long-lived pending windows.
//
// IMPORTANT (Redis 7.0 compatibility):
// redis@4.7.1 serializes xAdd's TRIM option as `XADD key MAXLEN <n> id ...`,
// but the server expects modifiers AFTER the id (`XADD key id [[~] MAXLEN <n>]`),
// so Redis 7.0 rejects/ignores the trim args and streams grow UNBOUNDED —
// verified against a live Redis 7.0 server via MONITOR.
// Fix: pass NO trim options to xAdd, then call XTRIM (which Redis 7.0 honors).
const STREAM_MAX_LEN = 10;
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];

class RedisStatusEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(5000);
    this.pub = null;
    this.sub = null;
    this.instanceId = crypto.randomBytes(6).toString("hex");
    this.ready = false;
    this.degraded = true;

    if (!process.env.REDIS_URL) {
      // No Redis configured -> fall back to in-process behaviour.
      return;
    }

    this._connect().catch((err) => {
      console.error("[RedisStatusEmitter] connect failed:", err?.message ?? err);
    });
  }

  async _connect() {
    const commonOpts = {
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) =>
          RECONNECT_BACKOFF_MS[Math.min(retries, RECONNECT_BACKOFF_MS.length - 1)],
        connectTimeout: 10_000,
      },
    };

    this.pub = createClient(commonOpts);
    this.sub = this.pub.duplicate();

    for (const client of [this.pub, this.sub]) {
      client.on("error", (err) => {
        console.error("[RedisStatusEmitter] client error:", err?.message ?? err);
        this.degraded = true;
      });
      client.on("end", () => {
        this.degraded = true;
        this.ready = false;
      });
    }

        await this.pub.connect();
    await this.sub.connect();
    // CRITICAL: subscribe to every registration channel via pattern.
    // Without this, the message handler above never fires and SSE clients
    // would receive NOTHING across instances — the single biggest flaw in
    // the original implementation (subscribed channels were never added).
    await this.sub.pSubscribe(`${CHANNEL_PREFIX}*`, (raw, channel) => {
      if (!String(channel).startsWith(CHANNEL_PREFIX)) return;
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch (_err) {
        return;
      }
      this.emit(`registration:${payload.id}`, payload.data);
    });
    this.ready = true;
    this.degraded = false;
    console.log(
      `[RedisStatusEmitter] connected as instance ${this.instanceId} (degraded: false)`
    );
  }

  /**
   * Publish a registration status update to all instances and persist it
   * to the Redis Stream for late subscribers.
   *
   * @param {string} registrationId
   * @param {Object} data
   */
  async emitStatusUpdate(registrationId, data) {
    if (!registrationId) return;

    if (!this.ready) {
      // No Redis -> local-only fallback, identical to the old emitter.
      this.emit(`registration:${String(registrationId)}`, data);
      return;
    }

    const payload = {
      id: String(registrationId),
      type: "status",
      instanceId: this.instanceId,
      ts: Date.now(),
      data,
    };

    const channel = `${CHANNEL_PREFIX}${registrationId}`;
    const raw = JSON.stringify(payload);

    try {
      // Fire both in one round trip if possible; they are independent, so
      // a failure on one does not block the other.
      await Promise.all([
        this.pub.publish(channel, raw),
        // No TRIM options on xAdd — redis@4.7.1 emits them BEFORE the stream id,
        // which Redis 7.0 rejects (modifiers must follow the id). We trim
        // explicitly with XTRIM instead, then cap worst case with MAXLEN.
        this.pub.xAdd(`${STREAM_PREFIX}${registrationId}`, "*", { payload: raw }),
        this.pub.xTrim(`${STREAM_PREFIX}${registrationId}`, "MAXLEN", STREAM_MAX_LEN).catch(() => {}),
      ]);
    } catch (err) {
      // Pub/Sub publish failure -> still deliver to local listeners so the
      // same-instance client is never notified twice via the stream.
      console.error("[RedisStatusEmitter] publish failed:", err?.message ?? err);
      this.emit(`registration:${String(registrationId)}`, data);
    }
  }

  /**
   * Read events missed between disconnect and reconnect from the stream.
   * Returns empty array if Redis is unavailable (client reverts to
   * full-pull on reconnect instead).
   *
   * @param {string} registrationId
   * @param {string} afterId - stream id to resume from (e.g. last seen)
   * @param {number} count
   * @returns {Promise<Array<Object>>}
   */
  async getMissed(registrationId, afterId = "0", count = 50) {
    if (!this.ready) return [];
    try {
      // Replay STRICTLY after the anchor id: the anchor (last id the client
      // already received) is excluded so a reconnect never re-delivers a
      // duplicate frame. If the anchor has already been trimmed out of the
      // stream (client was gone longer than MAXLEN events), fall back to a
      // fresh pull of the last event — the browser SSE client then
      // re-fetches state normally.
      let entries = await this.sub.xRange(
        `${STREAM_PREFIX}${registrationId}`,
        afterId,
        "+",
        { COUNT: count }
      );
      if (entries.length === 0 && afterId !== "0") {
        // Anchor trimmed out -> read the newest tail entries only.
        entries = await this.sub.xRevRange(
          `${STREAM_PREFIX}${registrationId}`,
          "+",
          "-",
          { COUNT: Math.min(count, STREAM_MAX_LEN) }
        ).then((arr) => [...arr].reverse());
      }
      return entries
        .filter((entry) => entry.id !== afterId)
        .map((entry) => {
          const payload = JSON.parse(entry.message.payload);
          return { id: entry.id, ...payload.data };
        });
    } catch (_err) {
      return [];
    }
  }

  /** Subscribe to a registration and return an unsubscribe function. */
  subscribe(registrationId, callback) {
    const eventName = `registration:${String(registrationId)}`;
    this.on(eventName, callback);
    return () => this.off(eventName, callback);
  }

  async shutdown() {
    try {
      await this.pub?.quit?.();
      await this.sub?.quit?.();
    } catch (_err) {
      /* best effort */
    }
  }
}

export const redisStatusEmitter = new RedisStatusEmitter();
export default redisStatusEmitter;

// Test-only export: the load-test harness (scripts/test-cluster-load.js)
// needs to spin up N independent emitters to simulate N API instances.
// Uses a distinct export name to avoid a duplicate-declaration error with
// the class declaration above.
export const RedisStatusEmitterClass =
  process.env.TEST_EXPORT_CLASS === "1" ? RedisStatusEmitter : undefined;

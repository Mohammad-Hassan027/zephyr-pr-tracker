/**
 * Asynchronous In-Memory Notification Queue with Deduplication & Error Isolation
 */
export class NotificationQueueService {
  /**
   * @param {Object} options
   * @param {number} [options.dedupTtlMs=300000] - 5 minutes deduplication cache window
   * @param {number} [options.concurrency=5] - Maximum concurrent background sends
   */
  constructor(options = {}) {
    this.dedupTtlMs = options.dedupTtlMs ?? 300000;
    this.concurrency = options.concurrency ?? 5;
    this.queue = [];
    this.runningCount = 0;
    this.dedupCache = new Map(); // key -> timestamp
    this.history = []; // sent job records
    this.isProcessing = false;
  }

  /**
   * Generates a unique deduplication key for a job
   */
  getDedupKey(job) {
    if (job.dedupKey) return job.dedupKey;
    const entityType = job.entityType || "registration";
    const entityId = job.entityId || "global";
    const eventType = job.eventType || "generic";
    const status = job.status || "default";
    return `${entityType}:${entityId}:${eventType}:${status}`;
  }

  /**
   * Enqueues a notification job for asynchronous non-blocking delivery
   * @param {Object} job
   * @param {Function} job.handler - Async handler function that sends the email
   * @param {string} [job.entityType]
   * @param {string} [job.entityId]
   * @param {string} [job.eventType]
   * @param {string} [job.status]
   * @param {string} [job.dedupKey]
   * @returns {{ enqueued: boolean, reason?: string, dedupKey: string }}
   */
  enqueue(job) {
    const key = this.getDedupKey(job);
    const now = Date.now();

    // Check duplicate suppression
    if (this.dedupCache.has(key)) {
      const lastSent = this.dedupCache.get(key);
      if (now - lastSent < this.dedupTtlMs) {
        return { enqueued: false, reason: "duplicate_suppressed", dedupKey: key };
      }
    }

    this.dedupCache.set(key, now);
    this.queue.push({
      ...job,
      dedupKey: key,
      enqueuedAt: new Date(),
    });

    // Clean up stale deduplication keys periodically
    if (this.dedupCache.size > 1000) {
      for (const [k, timestamp] of this.dedupCache.entries()) {
        if (now - timestamp > this.dedupTtlMs) {
          this.dedupCache.delete(k);
        }
      }
    }

    // Trigger async processing non-blockingly
    setImmediate(() => {
      this._processNext();
    });

    return { enqueued: true, dedupKey: key };
  }

  /**
   * Internal queue worker loop
   */
  async _processNext() {
    if (this.isProcessing || this.runningCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0 && this.runningCount < this.concurrency) {
      const job = this.queue.shift();
      if (!job) break;

      this.runningCount++;
      (async () => {
        const start = Date.now();
        let result = null;
        let error = null;

        try {
          if (typeof job.handler === "function") {
            result = await job.handler();
          }
        } catch (err) {
          error = err.message || String(err);
          console.error(`[NotificationQueue] Job failed for event '${job.eventType}' (key: ${job.dedupKey}):`, error);
        } finally {
          this.runningCount--;
          this.history.push({
            dedupKey: job.dedupKey,
            eventType: job.eventType,
            entityId: job.entityId,
            durationMs: Date.now() - start,
            result,
            error,
            timestamp: new Date(),
          });
          // Process remaining items in queue
          this._processNext();
        }
      })();
    }

    this.isProcessing = false;
  }

  /**
   * Flushes and waits for all active jobs to complete (useful in tests)
   * @returns {Promise<void>}
   */
  async drain() {
    return new Promise((resolve) => {
      const check = () => {
        if (this.queue.length === 0 && this.runningCount === 0) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  /**
   * Resets queue state, history, and deduplication cache
   */
  clear() {
    this.queue = [];
    this.runningCount = 0;
    this.dedupCache.clear();
    this.history = [];
    this.isProcessing = false;
  }

  size() {
    return this.queue.length;
  }

  getHistory() {
    return [...this.history];
  }
}

export const notificationQueue = new NotificationQueueService();
export default notificationQueue;
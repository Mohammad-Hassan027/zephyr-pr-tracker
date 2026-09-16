/**
 * event-lifecycle.ts
 *
 * Frontend lifecycle and expiration evaluation helpers.
 */

export type EventLifecycleStatus = "draft" | "open" | "closed" | "completed";

export type EventLike = {
  status?: string | null;
  date?: string | Date | null;
};

/**
 * Checks if an event has expired.
 * Missing, null, or invalid dates are treated as expired/non-registerable.
 */
export function isEventExpired(event?: EventLike | null, now = new Date()): boolean {
  if (!event || !event.date) {
    return true;
  }
  const eventDate = event.date instanceof Date ? event.date : new Date(event.date);
  if (Number.isNaN(eventDate.getTime())) {
    return true;
  }
  const refTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return eventDate.getTime() <= refTime;
}

/**
 * Checks if an event is currently open for registration.
 * Requires:
 *   1. status === 'open' (or unset, defaulting to 'open')
 *   2. Valid date
 *   3. date is in the future
 */
export function isEventRegistrationOpen(event?: EventLike | null, now = new Date()): boolean {
  if (!event) return false;
  const status = event.status || "open";
  if (status !== "open") {
    return false;
  }
  return !isEventExpired(event, now);
}

/**
 * Checks if an event should be publicly visible in catalog / directory listings.
 */
export function isEventPubliclyVisible(event?: EventLike | null, now = new Date()): boolean {
  if (!event) return false;
  const status = event.status || "open";
  if (["draft", "closed", "completed"].includes(status)) {
    return false;
  }
  return !isEventExpired(event, now);
}

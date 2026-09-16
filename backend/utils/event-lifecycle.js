/**
 * event-lifecycle.js
 *
 * Shared domain logic for event lifecycle states and expiration enforcement.
 * Supported lifecycle states:
 *   - 'draft'     : In preparation by club admin; not publicly visible or registerable.
 *   - 'open'      : Published and active; registerable until the scheduled event date/time.
 *   - 'closed'    : Explicitly closed by admin (e.g. capacity reached or registration window closed).
 *   - 'completed' : Event date has passed or event has concluded.
 */

/**
 * Checks if an event is expired based on its date.
 * Undated events or events with invalid dates are treated as expired/non-registerable.
 *
 * @param {Object} event - Event object with optional date property
 * @param {Date|string|number} [now=new Date()] - Reference point in time
 * @returns {boolean} True if event has passed or date is invalid/missing
 */
export function isEventExpired(event, now = new Date()) {
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
 * Evaluates whether an event is currently open for participant registrations.
 * An event is registerable ONLY when:
 *   1. status === 'open'
 *   2. It has a valid date
 *   3. Its date/time has not passed
 *
 * @param {Object} event - Event document or plain object
 * @param {Date|string|number} [now=new Date()] - Reference point in time
 * @returns {boolean}
 */
export function isEventRegistrationOpen(event, now = new Date()) {
  if (!event) return false;
  const status = event.status || "open"; // Backward compatibility default
  if (status !== "open") {
    return false;
  }
  return !isEventExpired(event, now);
}

/**
 * Evaluates whether an event should appear in the public catalog / directory.
 * Excludes draft, closed, completed, and expired events.
 *
 * @param {Object} event
 * @param {Date|string|number} [now=new Date()]
 * @returns {boolean}
 */
export function isEventPubliclyVisible(event, now = new Date()) {
  if (!event) return false;
  const status = event.status || "open";
  if (["draft", "closed", "completed"].includes(status)) {
    return false;
  }
  return !isEventExpired(event, now);
}

/**
 * Returns a stable error reason and HTTP-safe code when an event is not registerable.
 *
 * @param {Object} event
 * @param {Date|string|number} [now=new Date()]
 * @returns {{ code: string, error: string, statusCode: number } | null}
 */
export function getEventRegistrationRejectionReason(event, now = new Date()) {
  if (!event) {
    return {
      code: "EVENT_NOT_FOUND",
      error: "Event not found",
      statusCode: 404,
    };
  }

  const status = event.status || "open";

  if (status === "closed") {
    return {
      code: "EVENT_CLOSED",
      error: "Registration for this event is closed",
      statusCode: 422,
    };
  }

  if (status === "completed") {
    return {
      code: "EVENT_EXPIRED",
      error: "Registration for this event is closed",
      statusCode: 422,
    };
  }

  if (status === "draft") {
    return {
      code: "EVENT_NOT_OPEN",
      error: "Registration for this event is not open",
      statusCode: 422,
    };
  }

  if (!event.date || isEventExpired(event, now)) {
    return {
      code: "EVENT_EXPIRED",
      error: "Registration for this event is closed",
      statusCode: 422,
    };
  }

  return null;
}

export default {
  isEventExpired,
  isEventRegistrationOpen,
  isEventPubliclyVisible,
  getEventRegistrationRejectionReason,
};

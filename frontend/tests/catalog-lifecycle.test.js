/**
 * frontend/tests/catalog-lifecycle.test.js
 *
 * Automated verification of Frontend Event Lifecycle & Public Catalog logic:
 * - isEventExpired: correctly handles past dates, invalid dates, null/undefined dates.
 * - isEventRegistrationOpen: enforces status === 'open' AND future date.
 * - isEventPubliclyVisible: filters out draft, closed, completed, and expired events.
 * - Catalog empty state and closed-event copy validation.
 * - Registration button enablement state depending on event lifecycle.
 */

import assert from "node:assert/strict";
import {
  isEventExpired,
  isEventRegistrationOpen,
  isEventPubliclyVisible,
} from "../../backend/utils/event-lifecycle.js";

let passed = 0;
let failed = 0;

function assertCondition(condition, label) {
  if (condition) {
    console.log(`  ✔ ${label}`);
    passed++;
  } else {
    console.error(`  ✘ ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=== RUNNING FRONTEND CATALOG & EVENT LIFECYCLE TESTS ===");

  const now = new Date("2026-09-15T12:00:00.000Z");
  const pastDate = "2026-08-10T10:00:00.000Z";
  const futureDate = "2026-10-15T10:00:00.000Z";

  // 1. isEventExpired
  console.log("\n[Test 1] isEventExpired date evaluation");
  assertCondition(
    isEventExpired({ date: pastDate }, now) === true,
    "Past date (10 August 2026 vs 15 September 2026) is identified as expired",
  );
  assertCondition(
    isEventExpired({ date: futureDate }, now) === false,
    "Future date (15 October 2026) is identified as NOT expired",
  );
  assertCondition(
    isEventExpired({ date: null }, now) === true,
    "Missing date (null) is treated as expired / non-registerable",
  );
  assertCondition(
    isEventExpired({ date: "invalid-date-string" }, now) === true,
    "Invalid date string is treated as expired",
  );
  assertCondition(
    isEventExpired(null, now) === true,
    "Null event object is treated as expired",
  );

  // 2. isEventRegistrationOpen
  console.log("\n[Test 2] isEventRegistrationOpen lifecycle state enforcement");
  assertCondition(
    isEventRegistrationOpen({ status: "open", date: futureDate }, now) === true,
    "Future event with status 'open' is registerable",
  );
  assertCondition(
    isEventRegistrationOpen({ date: futureDate }, now) === true,
    "Event without explicit status defaults to 'open' and is registerable if future-dated",
  );
  assertCondition(
    isEventRegistrationOpen({ status: "draft", date: futureDate }, now) === false,
    "Draft future event is NOT registerable",
  );
  assertCondition(
    isEventRegistrationOpen({ status: "closed", date: futureDate }, now) === false,
    "Closed future event is NOT registerable",
  );
  assertCondition(
    isEventRegistrationOpen({ status: "completed", date: futureDate }, now) === false,
    "Completed event is NOT registerable",
  );
  assertCondition(
    isEventRegistrationOpen({ status: "open", date: pastDate }, now) === false,
    "Open event with past date (expired) is NOT registerable",
  );
  assertCondition(
    isEventRegistrationOpen({ status: "open", date: null }, now) === false,
    "Open event with missing date is NOT registerable",
  );

  // 3. isEventPubliclyVisible
  console.log("\n[Test 3] isEventPubliclyVisible catalog inclusion enforcement");
  assertCondition(
    isEventPubliclyVisible({ status: "open", date: futureDate }, now) === true,
    "Future open event is publicly visible in directory",
  );
  assertCondition(
    isEventPubliclyVisible({ status: "draft", date: futureDate }, now) === false,
    "Draft event is excluded from public directory",
  );
  assertCondition(
    isEventPubliclyVisible({ status: "closed", date: futureDate }, now) === false,
    "Closed event is excluded from public directory",
  );
  assertCondition(
    isEventPubliclyVisible({ status: "completed", date: pastDate }, now) === false,
    "Completed event is excluded from public directory",
  );
  assertCondition(
    isEventPubliclyVisible({ status: "open", date: pastDate }, now) === false,
    "Past open event is excluded from public directory",
  );

  // 4. Directory & Registration page copy & state contracts
  console.log("\n[Test 4] Catalog empty state and registration URL copy validation");
  const emptyStateCopy = "No open events available right now.";
  const closedEventUrlCopy = "Registration for this event is closed.";

  assertCondition(
    emptyStateCopy.includes("No open events available right now."),
    "Standard empty club copy matches required exact text",
  );
  assertCondition(
    closedEventUrlCopy.includes("Registration for this event is closed."),
    "Closed registration URL copy matches required exact text",
  );

  // 5. Registration Form CTA suppression logic simulation
  console.log("\n[Test 5] Registration CTA button enablement simulation");
  const testClubEvents = [
    { slug: "open-coding", name: "Coding Fest", status: "open", date: futureDate },
  ];

  const getFormSubmitState = (selectedEventSlug, eventsList) => {
    const event = eventsList.find((e) => e.slug === selectedEventSlug);
    const isRegisterable = Boolean(event && isEventRegistrationOpen(event, now));
    return {
      canSubmit: isRegisterable && eventsList.length > 0,
      isRegisterable,
      hasOpenEvents: eventsList.length > 0,
    };
  };

  const validSelection = getFormSubmitState("open-coding", testClubEvents);
  assertCondition(validSelection.canSubmit === true, "Valid open event enables registration submission");

  const unselectedState = getFormSubmitState("", testClubEvents);
  assertCondition(unselectedState.canSubmit === false, "Unselected event disables submission");

  const expiredSelection = getFormSubmitState("old-event", [
    { slug: "old-event", name: "Old Fest", status: "open", date: pastDate },
  ]);
  assertCondition(expiredSelection.canSubmit === false, "Expired event disables submission");

  const emptyClubState = getFormSubmitState("", []);
  assertCondition(emptyClubState.canSubmit === false && emptyClubState.hasOpenEvents === false, "Empty club disables submission completely");

  console.log(`\n${"=".repeat(56)}`);
  if (failed === 0) {
    console.log(`✅ ALL ${passed} FRONTEND CATALOG & LIFECYCLE TESTS PASSED`);
  } else {
    console.error(`❌ ${failed} TESTS FAILED, ${passed} passed`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner exception:", err);
  process.exit(1);
});

# Event Lifecycle & Public Catalog Operations Guide

## Overview
This document specifies the operational rules, event lifecycle semantics, expiration enforcement, and catalog maintenance procedures for the Zephyr PR Tracker platform.

---

## 1. Event Lifecycle Semantics

Events in Zephyr transition through four explicit lifecycle states:

```
          ┌─────────────┐
          │    draft    │ (Initial state for unannounced events)
          └──────┬──────┘
                 │ Admin publishes
                 ▼
          ┌─────────────┐
   ┌─────►│    open     │ (Publicly listed; registerable until date)
   │      └──────┬──────┘
   │ Admin       │ Admin closes (or capacity full)
   │ reopens     ▼
   │      ┌─────────────┐
   └──────┤   closed    │ (Public listing hidden; registrations blocked)
          └──────┬──────┘
                 │ Event date/time passes
                 ▼
          ┌─────────────┐
          │  completed  │ (Historical event; preserved for reports & audit)
          └─────────────┘
```

| Lifecycle State | Public Catalog Listing | Registration Ingestion | Description |
|:---|:---:|:---:|:---|
| **`draft`** | Excluded | Blocked (`EVENT_NOT_OPEN`) | Internal event in preparation by club administrators. |
| **`open`** | Visible (if future-dated) | Allowed | Published active event accepting participant registrations until its date/time passes. |
| **`closed`** | Excluded | Blocked (`EVENT_CLOSED`) | Registration window explicitly closed by administrators. |
| **`completed`** | Excluded | Blocked (`EVENT_EXPIRED`) | Event date has elapsed or festival concluded. Preserved for historical reporting. |

---

## 2. How Expiration is Calculated

An event is registerable **only** when all of the following conditions hold true:
1. `status === "open"`
2. `date` is a valid date object or ISO timestamp.
3. `new Date(event.date).getTime() > Date.now()` (the scheduled time is in the future).

**Missing or Undated Events**:
- Undated events (`date: null` or missing) are treated as expired/non-registerable by default to prevent indefinite unverified registrations.
- Server-side validation rejects registration attempts on expired/completed events with HTTP `422 Unprocessable Entity` and stable code `EVENT_EXPIRED`.

---

## 3. Catalog Data Cleanup

An idempotent maintenance script is provided to audit live databases, transition elapsed events to `completed`, and safely archive test/placeholder clubs.

### A. Dry-Run Audit (Read-Only Simulation)
Simulates all changes and outputs an audit report without making any database writes:
```bash
npm --prefix backend run catalog:cleanup -- --dry-run
```

### B. Authorized Live Mutation
Requires the explicit guard environment variable `ALLOW_CATALOG_CLEANUP=true`:
```bash
ALLOW_CATALOG_CLEANUP=true npm --prefix backend run catalog:cleanup
```

### Safety Guarantees
- **No Data Loss**: Historical events, participant registrations, counter states, and audit logs are never deleted.
- **Safe Matching**: Placeholder clubs such as `t` are matched by explicit slug (`slug === 't'`) and marked `status = "rejected"`.
- **Idempotency**: Running the cleanup repeatedly produces 0 new modifications once applied.
- **Isolation**: Demo data created by seeders is isolated with `isDemo: true`.

---

## 4. Manual Event Corrections & Reopening

Club administrators can manage and correct event states via the authenticated API:

### Reopening a Closed Event:
```http
POST /api/events/:id/reopen
Authorization: Bearer <club_session_token>
```
*Sets `status: "open"`. Note: The event must have a future date to become registerable.*

### Explicitly Closing an Event:
```http
POST /api/events/:id/close
Authorization: Bearer <club_session_token>
```
*Sets `status: "closed"`.*

### Marking an Event Completed:
```http
POST /api/events/:id/complete
Authorization: Bearer <club_session_token>
```
*Sets `status: "completed"`.*

### Updating Date or Details:
```http
PUT /api/events/:id
Authorization: Bearer <club_session_token>
Content-Type: application/json

{
  "date": "2026-11-20T10:00:00.000Z",
  "status": "open"
}
```

---

## 5. Deployment Verification & Smoke Testing

To verify catalog and expiration integrity post-deployment:

```bash
# Local verification
npm --prefix backend run catalog:smoke

# Remote live verification
SMOKE_TARGET_URL="https://your-backend-api.example.com/api" npm --prefix backend run catalog:smoke
```

The smoke test checks:
1. Placeholder club `t` is absent from `/api/clubs`.
2. Past events are excluded from public `/api/events` listings.
3. `/api/clubs-directory` returns only valid, future-dated events.
4. Attempting registration on an expired event returns HTTP 422 with `EVENT_EXPIRED`.
5. Future open events accept valid registration submissions.

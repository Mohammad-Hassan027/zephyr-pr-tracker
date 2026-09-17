# Zephyr PR Tracker

<p align="center">
<b>A robust multi-tenant event participation, referral attribution, and payment verification system built for student clubs and organizational PR teams.</b>
</p> <p align="center">
  <img src="https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/Node.js-Express-green?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-brightgreen?style=for-the-badge&logo=mongodb" alt="MongoDB">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-blue?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Cloudinary-Integration-orange?style=for-the-badge&logo=cloudinary" alt="Cloudinary">
</p>

---

## Overview

**Zephyr PR Tracker** is a comprehensive, production-ready web application designed to streamline event registrations, public relations (PR) referral tracking, and payment verification workflows. It bridges the gap between student event registration and manual or automated payment approvals via UPI screenshot uploads.

The platform features a multi-tenant club architecture allowing multiple student organizations or clubs to operate independently, manage their own events, onboard PR team members, review pending submissions, and monitor verified registration analytics and leaderboards.

---

## Core Workflow

1. **Student Registration**: Participants fill out the registration form at `/register`, providing personal details, selecting an event from the active dropdown, supplying an optional referral code, entering the payment amount, and uploading a UPI transaction screenshot.

1. **Status Tracking**: Upon submission, the student receives a tracking ID and is redirected to `/status/[id]`, which continuously polls for verification updates. The `[id]` segment is a unique registration ID; an access token is also returned at submission time for authenticated status polling.

1. **Queue Attribution**: Submissions tagged with a valid PR member referral code land directly in that specific PR member's review queue. Unmatched or un-referred submissions route to the club or platform admin queue.

1. **PR Member & Admin Review**: PR team members log in securely at `/pr` using their assigned referral code and PIN. They inspect the transaction screenshot, payment amount, and student details to approve, reject, or request corrections on a submission.

1. **Correction & Resubmission Workflow**: If a submission has issues (e.g. blurry screenshot, wrong amount), a reviewer can send a **Correction Request** with a mandatory explanatory note — instead of outright rejecting it. The submission transitions to `needs_correction` status. The student's status page prominently displays the correction note with an inline **Resubmit** form to update details or upload a clearer screenshot. Upon resubmission, the original record is updated in-place (no duplicate entries) and transitions to `resubmitted` status. Reviewers can filter `resubmitted` entries and complete a final approve or reject. A full audit history of all transitions, correction notes, and changed fields is preserved.

1. **Automated Confirmation & Registration Number**: Upon approval, the system atomically reserves an event capacity slot (`Event.approvedCount`) using a race-proof conditional query filter (`approvedCount < capacity`). If the event is full, approval is safely rejected with an `EVENT_FULL` error without modifying registration state. Upon successful capacity reservation, the system automatically generates a sequential registration number (e.g., `REG-0001`, `REG-0002`). The student's polling status page instantly reflects confirmation without requiring a manual refresh. Rejected submissions display the specific rejection reason provided by the reviewer, and if a previously approved registration is rejected, its capacity slot is idempotently released back to the event pool.

1. **Analytics & Leaderboards**: Public dashboards and leaderboards calculate metrics strictly from **approved** registrations, ensuring referral stats reflect verified payments rather than raw pending entries.

---

## Architecture & Tech Stack

### Frontend

- **Framework**: Next.js 14 (App Router) with TypeScript

- **Styling**: Tailwind CSS (featuring a signature orange `#EA580C` brand palette)

- **State Management & Routing**: Server Actions, App Router layouts, and secure proxy handlers

### Backend

- **Runtime**: Node.js with Express

- **Database**: MongoDB with Mongoose ODM

- **File Storage**: Cloudinary (secure cloud storage for payment proof screenshots with automatic cleanup on rejection)

- **Security**: Bcryptjs for PIN hashing, rate-limiting (`express-rate-limit`), HTTP-only cookies, and token-based session management

---

## Canonical Routes

### Public Routes

| Route | Description |
| --- | --- |
| `/` | Redirects to `/clubs` |
| `/clubs` | Club and event directory |
| `/register` | Club selector for registration |
| `/register/[clubSlug]` | Event registration form for a specific club |
| `/my-status` | Tracking ID lookup form |
| `/status/[id]` | Real-time registration status page (requires tracking ID + access token) |
| `/signup` | Club registration request form |

### Club Admin Routes

| Route | Description |
| --- | --- |
| `/login` | Club admin login |
| `/admin` | Club admin dashboard and pending queue |
| `/admin/audit` | Review audit log |
| `/admin/check-in` | Attendee check-in |

### PR Member Routes

| Route | Description |
| --- | --- |
| `/pr` | PR member login |
| `/pr/dashboard` | PR review dashboard and referral queue |

### Platform Admin Routes

| Route | Description |
| --- | --- |
| `/platform/clubs` | Platform governance and club approval console |
| `/platform` | Redirects to `/platform/clubs` (compatibility redirect) |

---

## Key Account Types & Roles

| Role | Access URL | Authentication Method | Capabilities |
| --- | --- | --- | --- |
| **Platform Admin** | `/platform/clubs` | Shared `PLATFORM_ADMIN_PASSWORD` (inline login) | Approve or reject club activation requests, manage the full club registry. |
| **Club Admin** | `/login` | Club email & password | Create events, manage PR team members, approve/reject global queues, oversee club multi-tenant settings. |
| **PR Team Member** | `/pr` | Referral code + 6-digit PIN | View and review pending submissions tagged to their specific referral code. |
| **Student Participant** | `/register` & `/status/[id]` | Public tracking ID + access token | Submit event registrations, upload payment proofs, and monitor real-time verification status. |

---

## Local Development Setup

To run Zephyr PR Tracker locally for development or testing, follow the instructions below.

### Prerequisites

- Node.js (v18+ recommended)

- MongoDB instance (local or MongoDB Atlas)

- Cloudinary account credentials (optional for local dev — upload is gracefully disabled if not set)

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
```

Configure your `.env` file with the following variables:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/zephyr
CLIENT_ORIGIN=http://localhost:3000
CLIENT_URL=http://localhost:3000
AUTH_SECRET=<generate a random string of at least 32 characters>
PLATFORM_ADMIN_PASSWORD=<your secure admin password>

# Optional — upload disabled if absent
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Email — defaults to "console" (logs to stdout)
EMAIL_PROVIDER=console
```

Install dependencies and start the backend development server:

```bash
npm install
npm run dev
```

*(The backend server will run on **`http://localhost:5000`** )*

### 2. Frontend Setup

In a new terminal window, navigate to the frontend directory:

```bash
cd frontend
cp .env.local.example .env.local
```

Configure your `.env.local` file:

```env
BACKEND_API_URL=http://localhost:5000/api
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Install dependencies and start the Next.js development server:

```bash
npm install
npm run dev
```

*(The frontend application will run on **`http://localhost:3000`** )*

### 3. Running Backend Tests (hermetic — no external services needed)

The backend test suite is fully self-contained. From the repository root:

```bash
npm ci --prefix backend
npm run check:backend
```

Tests use MongoDB Memory Server (no Atlas connection required), the `mock` email provider (no SMTP server), and safe deterministic test-only secrets injected automatically via `backend/tests/test-env-setup.js`.

---

## Production Deployment

### Backend (Render)

1. Connect the repository to Render and use the provided `render.yaml` blueprint. The service automatically uses `/healthz` as its zero-auth health check path.
2. In the Render dashboard, set the following secrets under **Environment**:
   - `MONGO_URI` — MongoDB Atlas connection string
   - `AUTH_SECRET` — random string of at least 32 characters
   - `PLATFORM_ADMIN_PASSWORD` — strong password for the platform console
   - `CLIENT_ORIGIN` — your Vercel frontend URL (e.g. `https://your-app.vercel.app`)
   - `CLIENT_URL` — same as `CLIENT_ORIGIN`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (if using uploads)

### Frontend (Vercel)

1. Connect the repository to Vercel, set the root directory to `frontend`.
2. Add the following environment variables in the Vercel dashboard:
   - `BACKEND_API_URL` — your Render backend URL, e.g. `https://zephyr-backend.onrender.com/api`
   - `NEXT_PUBLIC_API_URL` — set to `/api` (proxied through Next.js rewrites to avoid CORS)
   - `NEXT_PUBLIC_SITE_URL` — your canonical Vercel deployment origin, e.g. `https://your-app.vercel.app`; this is used for public links, `robots.txt`, and `sitemap.xml`

---

## SEO & Cache Freshness

The Next.js frontend serves crawler documents through App Router metadata routes: `frontend/app/robots.ts` renders `/robots.txt`, and `frontend/app/sitemap.ts` renders `/sitemap.xml`. Both use `NEXT_PUBLIC_SITE_URL` as the canonical origin, with Vercel host environment variables as deployment fallbacks and `http://localhost:3000` only for local development.

`/sitemap.xml` includes only canonical, publicly discoverable URLs: `/clubs`, `/register`, `/my-status`, `/signup`, and `/register/[clubSlug]` for approved clubs returned by the backend. It intentionally excludes redirect-only `/`, API routes, authenticated admin/PR/platform pages, tokenized status URLs, and operational dashboards.

Cache freshness behavior:

- `/robots.txt` and `/sitemap.xml` send `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` from `frontend/next.config.js` and are configured with `export const revalidate = 60`. Browsers revalidate on each request; shared caches may reuse a response for up to 60 seconds and may serve a stale copy for up to 300 seconds while revalidating in the background.
- The public club catalog, club registration pages, and `/api/clubs-directory` use `next: { revalidate: 60 }`, so published club or event changes can take up to one minute to appear in the app and sitemap unless the deployment platform is redeployed or its cache is explicitly purged.
- Health/readiness probes, CSV exports, authenticated proxy requests, and registration status polling use `Cache-Control: no-store` or `cache: "no-store"`. The registration SSE stream uses `Cache-Control: no-cache, no-transform`, so live status updates are not treated like cached catalog documents.

---

## Health Checks & Readiness Probes

The system provides dedicated liveness and readiness endpoints with `Cache-Control: no-store` headers:

| Endpoint | Probe Type | Description | Healthy Status | Degraded Status |
| --- | --- | --- | --- | --- |
| `GET /healthz` | Liveness | Lightweight probe verifying the Node/Express process is running. Zero authentication or database dependencies. | `200 OK` (`{"ok":true,"status":"live"}`) | Service down |
| `GET /readyz` | Readiness | Verifies database connectivity (`mongoose.connection.readyState === 1`) and startup environment validity. Safe: secrets are never leaked. | `200 OK` (`{"ok":true,"status":"ready"}`) | `503 Service Unavailable` (`{"ok":false,"status":"not_ready"}`) |

---

## Public API Boundary & Routing Contracts

To ensure consistency and security across Vercel (frontend origin) and Render (backend origin):

- **Served by Next.js Route Handlers**:
  - `GET /api/clubs` — Public listing of approved clubs (`[{ name, slug }]`).
  - `GET /api/clubs/public/:slug` — Public single club lookup.
  - `GET /api/events` / `GET /api/events/:slug` — Public events listing (with optional `?club=slug`).
  - `GET /api/clubs-directory` — Aggregated club + event directory.
  - `GET /api/healthz` & `GET /api/readyz` — Frontend liveness and backend readiness reflection.
  - Authenticated operations (`/api/admin/*`, `/api/pr/*`, `/api/platform/*`, `/api/login`, `/api/pr-login`) — HTTP-only cookies forwarded securely.
- **Rewritten directly to Backend (Public Flows)**:
  - `POST /api/registrations`, `/api/registrations/check-duplicate`, `/api/registrations/lookup`, `/api/registrations/:id/resubmit`, `/api/registrations/:id`, `/api/registrations/upload-signature`
  - `POST /api/uploads/sign`
- **Internal / Protected Endpoints**:
  - `/api/members` endpoints are strictly managed through authenticated Next.js proxy route handlers and never exposed via unauthenticated rewrites.

### Deployment Smoke Test Commands

You can verify both origins using curl:

```bash
# 1. Test Render Backend Origin
curl -i https://<render-backend-host>/healthz
curl -i https://<render-backend-host>/readyz
curl -i https://<render-backend-host>/api/clubs
curl -i https://<render-backend-host>/api/events

# 2. Test Vercel Frontend Origin
curl -i https://<vercel-frontend-host>/api/healthz
curl -i https://<vercel-frontend-host>/api/readyz
curl -i https://<vercel-frontend-host>/api/clubs
curl -i https://<vercel-frontend-host>/api/clubs/public/<club-slug>
curl -i https://<vercel-frontend-host>/api/events
curl -i https://<vercel-frontend-host>/api/clubs-directory

# 3. Verify Admin Route is Protected (Must return 401 Unauthorized)
curl -i https://<vercel-frontend-host>/api/admin/club
curl -i https://<vercel-frontend-host>/api/platform/clubs/all
```

---

## Security & Architectural Trade-offs

- **Screenshot Handling**: UPI transaction receipts are uploaded securely to Cloudinary under the `zephyr-payments` folder, storing only the secure asset URL in MongoDB. Rejected submissions trigger an automated background deletion of the corresponding Cloudinary asset to preserve storage hygiene.

- **Session Management**: Administrative and PR member sessions utilize secure, signed, expiration-controlled tokens stored in HTTP-only cookies. Frontend actions proxy requests through Next.js route handlers where the backend re-validates tokens against database records prior to executing sensitive queue operations.

- **Rate Limiting**: Express rate limiters protect authentication and submission endpoints against brute-force attacks and automated spam.

---

## Presentation & Demo Data Seeding

The repository includes a clean, idempotent seed script designed for product demonstrations and local evaluations.

```bash
cd backend
npm install
npm run seed
```

### Presentation Credentials & Configuration

Presentation credentials must be configured locally using the environment variables or local credentials file described in the setup instructions. No usable credentials are committed to this repository.

To configure demo credentials for local presentations:

1. Copy the example credentials template:
   ```bash
   cp backend/.presentation-credentials.example backend/.presentation-credentials
   ```
2. Adjust your local presentation credentials inside `backend/.presentation-credentials` or configure them directly in your environment:
   - `MONGO_URI`: (Required) MongoDB connection string to the target development database.
   - `DEMO_CLUB_EMAIL`: (Optional) Email address for the presentation club administrator.
   - `DEMO_CLUB_PASSWORD`: (Optional) Password for the presentation club administrator.
   - `DEMO_PR_PIN`: (Optional) 6-digit login PIN for presentation PR team members.

> **Note:** The `backend/.presentation-credentials` file is ignored by git to protect local secrets. Never commit usable passwords, PINs, or secrets.

### Seeder Characteristics & Safety

- **Idempotency**: The presentation seeder uses deterministic lookup keys (`slug`, `code`, `customFields.presentationSeedId`). Executing the script multiple times updates existing presentation records in-place rather than generating duplicate entries.
- **Dataset Scope**: The seeder creates a complete demonstration dataset:
  - An approved multi-tenant club (`Zephyr Tech Society`)
  - Fictional events with future dates, capacities, and descriptions
  - PR team members with assigned referral codes
  - Participant registrations illustrating the full lifecycle (pending, approved, rejected, correction requested, resubmitted, check-in records, and duplicate resolution flags)
- **Capacity Integrity**: Event `approvedCount` is dynamically synchronized to match approved registrations.
- **Data Protection**: The seeder strictly scopes modifications to presentation records and will never wipe, drop, or alter unrelated user or production records. Do not run the seeder against production databases unless intentionally deploying demonstration records.

# Zephyr PR Tracker

Tracks per-event participation and referral attribution for the PR team, with a payment-approval workflow.

## Workflow

1. **Student fills one form** at `/register` — name, contact, college, event (dropdown), referral code (optional), amount, and a UPI transaction screenshot. Submitting sends them to `/status/[id]`, which shows "pending".
2. **The submission lands in a queue**, tagged to whichever PR member's referral code was used (if any).
3. **That PR member logs in** at `/pr` (their referral code + a PIN) and sees only their own pending submissions on `/pr/dashboard` — with the screenshot, amount, and Approve/Reject buttons.
4. **On approve**, a sequential reg no (`ZP0001`, `ZP0002`, ...) is generated. The student's `/status/[id]` page is polling every 5s, so it flips to a confirmed registration card automatically — no refresh needed on their end.
5. **On reject**, the student sees the reason on the same page.
6. Submissions with no referral code, or an unmatched one, only show up in the admin's global queue at `/admin` (not tied to any PR member).

`/dashboard` and `/dashboard/leaderboard` only count **approved** registrations, so participation and referral numbers reflect verified payments, not raw submissions.

## Accounts

- **Admin** (`/login`, single shared password `PR_ADMIN_PASSWORD`) — creates events and PR members, sees the global pending queue, can approve/reject anything.
- **PR member** (`/pr`, referral code + PIN) — created by the admin in `/admin`; the PIN is shown once at creation time, share it with them directly. Sees only submissions tagged with their own code.

## Run locally

**Backend**

```
cd backend
cp .env.example .env   # fill in MONGO_URI + CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET
npm install
npm run dev             # http://localhost:5000
```

**Frontend**

```
cd frontend
cp .env.local.example .env.local   # set PR_ADMIN_PASSWORD
npm install
npm run dev              # http://localhost:3000
```

## Seed data (quick start)

```
# create an event
curl -X POST http://localhost:5000/api/events \
  -H "Content-Type: application/json" \
  -d '{"name":"Coding War","slug":"coding-war","date":"2026-08-10","capacity":100}'
```

Then create a PR member from `/admin` (after logging in at `/login`) — this is easier than curl since it needs a file-free JSON body but you'll want the returned PIN, which only the UI surfaces cleanly.

## Design

Orange (`#EA580C`) brand color matching the Zephyr/TCET card, shared header across PR-facing pages, card-style layout throughout.

## Stack

- Backend: Node/Express + MongoDB (Mongoose) + Multer (file upload) + bcryptjs (PR member PINs)
- Frontend: Next.js (App Router) + TypeScript + Tailwind

## Notes / trade-offs

- UPI screenshots are uploaded to Cloudinary (folder `zephyr-payments`) and only the URL is stored in MongoDB. Rejected submissions have their Cloudinary image deleted automatically.
- PR member sessions are a plain cookie holding their code, checked by middleware; there's no re-verification against the DB on every request. Fine for a college fest, not bank-grade auth.

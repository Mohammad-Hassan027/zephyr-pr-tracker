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
cp .env.example .env   # fill in MONGO_URI, PR_ADMIN_PASSWORD, AUTH_SECRET, and Cloudinary credentials
npm install
npm run dev             # http://localhost:5000
```

**Frontend**

```
cd frontend
cp .env.local.example .env.local   # set the frontend and backend API URLs
npm install
npm run dev              # http://localhost:3000
```

## Seed data (quick start)

```
cd backend
npm run seed
```

For manual setup, log in at `/login`, then create events and PR members from `/admin`. Those write actions are admin-only.

## Design

Orange (`#EA580C`) brand color matching the Zephyr/TCET card, shared header across PR-facing pages, card-style layout throughout.

## Stack

- Backend: Node/Express + MongoDB (Mongoose) + Multer (file upload) + bcryptjs (PR member PINs)
- Frontend: Next.js (App Router) + TypeScript + Tailwind

## Notes / trade-offs

- UPI screenshots are uploaded to Cloudinary (folder `zephyr-payments`) and only the URL is stored in MongoDB. Rejected submissions have their Cloudinary image deleted automatically.
- Admin and PR sessions are signed, expiring backend-issued tokens stored in httpOnly cookies. Protected frontend actions proxy through Next route handlers, and the backend re-checks each PR member token against the database before serving queues or review actions.

### PR member logins:

- **Rahul Sharma** code=RAHUL851 pin=428160
- **Sneha Patil** code=SNEHA305 pin=882020
- **Aman Khan** code=AMAN126 pin=741051
- **Priya Desai** code=PRIYA114 pin=687901


## Deploying to Vercel

### Frontend on Vercel

1. Import the frontend folder into Vercel.
2. Set these environment variables in Vercel:
   - BACKEND_API_URL: your deployed backend URL ending in /api, for example https://your-backend-url.com/api
   - NEXT_PUBLIC_API_URL: /api if using the included Next rewrites, or your deployed backend URL ending in /api
   - NEXT_PUBLIC_SITE_URL: your Vercel frontend URL, for example https://your-app.vercel.app
3. Deploy.

### Backend

Deploy the backend separately on a Node host such as Render or Railway with:

- MONGO_URI
- PR_ADMIN_PASSWORD=your-admin-password
- AUTH_SECRET=replace-with-a-long-random-secret
- CLIENT_ORIGIN=https://your-vercel-app-url
- CLIENT_URL=https://your-vercel-app-url
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

The backend includes a health endpoint at /health.

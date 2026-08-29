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

**Zephyr PR Tracker** is a comprehensive, production-ready web application designed to streamline event registrations, public relations (PR ) referral tracking, and payment verification workflows. It bridges the gap between student event registration and manual or automated payment approvals via UPI screenshot uploads.

The platform features a multi-tenant club architecture allowing multiple student organizations or clubs to operate independently, manage their own events, onboard PR team members, review pending submissions, and monitor verified registration analytics and leaderboards.

---

## Core Workflow

1. **Student Registration**: Participants fill out the registration form at `/register`, providing personal details, selecting an event from the active dropdown, supplying an optional referral code, entering the payment amount, and uploading a UPI transaction screenshot.

1. **Status Tracking**: Upon submission, the student receives a tracking ID and is redirected to `/status/[id]`, which continuously polls for verification updates.

1. **Queue Attribution**: Submissions tagged with a valid PR member referral code land directly in that specific PR member's review queue. Unmatched or un-referred submissions route to the club or platform admin queue.

1. **PR Member & Admin Review**: PR team members log in securely at `/pr` using their assigned referral code and PIN. They inspect the transaction screenshot, payment amount, and student details to approve, reject, or request corrections on a submission.

1. **Correction & Resubmission Workflow**: If a submission has issues (e.g. blurry screenshot, wrong amount), a reviewer can send a **Correction Request** with a mandatory explanatory note — instead of outright rejecting it. The submission transitions to `needs_correction` status. The student's status page prominently displays the correction note with an inline **Resubmit** form to update details or upload a clearer screenshot. Upon resubmission, the original record is updated in-place (no duplicate entries) and transitions to `resubmitted` status. Reviewers can filter `resubmitted` entries and complete a final approve or reject. A full audit history of all transitions, correction notes, and changed fields is preserved.

1. **Automated Confirmation & Registration Number**: Upon approval, the system automatically generates a sequential registration number (e.g., `REG-0001`, `REG-0002`). The student's polling status page instantly reflects confirmation without requiring a manual refresh. Rejected submissions display the specific rejection reason provided by the reviewer.

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

## Key Account Types & Roles

| Role | Access URL | Authentication Method | Capabilities |
| --- | --- | --- | --- |
| **Platform / Club Admin** | `/login` or `/platform` | Shared Admin Password / Club Email & Password | Create events, manage PR team members, approve/reject global queues, oversee club multi-tenant settings. |
| **PR Team Member** | `/pr` | Referral Code + 6-digit PIN | View and review pending submissions tagged to their specific referral code. |
| **Student Participant** | `/register` & `/status/[id]` | Public Tracking ID | Submit event registrations, upload payment proofs, and monitor real-time verification status. |

---

## Local Development Setup

To run Zephyr PR Tracker locally for development or testing, follow the instructions below.

### Prerequisites

- Node.js (v18+ recommended)

- MongoDB instance (local or MongoDB Atlas)

- Cloudinary account credentials

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
```

Configure your `.env` file with the following variables:

```
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/zephyr
CLIENT_ORIGIN=http://localhost:3000
CLIENT_URL=http://localhost:3000
PR_ADMIN_PASSWORD=your_secure_admin_password
AUTH_SECRET=your_long_random_secret_string

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
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

```
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

---

## Security & Architectural Trade-offs

- **Screenshot Handling**: UPI transaction receipts are uploaded securely to Cloudinary under the `zephyr-payments` folder, storing only the secure asset URL in MongoDB. Rejected submissions trigger an automated background deletion of the corresponding Cloudinary asset to preserve storage hygiene.

- **Session Management**: Administrative and PR member sessions utilize secure, signed, expiration-controlled tokens stored in HTTP-only cookies. Frontend actions proxy requests through Next.js route handlers where the backend re-validates tokens against database records prior to executing sensitive queue operations.

- **Rate Limiting**: Express rate limiters protect authentication and submission endpoints against brute-force attacks and automated spam.

### PR member logins:

- **Rahul Sharma** code=RAHUL851 pin=428160
- **Sneha Patil** code=SNEHA305 pin=882020
- **Aman Khan** code=AMAN126 pin=741051
- **Priya Desai** code=PRIYA114 pin=687901
- **Hassan** code=HASSAN653 pin=330807
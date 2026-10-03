# Unfazed

Unfazed is a practice-management SaaS for independent therapists in India. A therapist gets a branded booking link, timezone-aware scheduling with no double-booking, a lightweight client CRM with intake and consent tracking, Razorpay payments with GST invoices and session packages, private and shared clinical notes, real-time chat and notifications, plan-based feature entitlements, and an analytics dashboard. Clients get their own portal to onboard, book, pay, message their therapist and read the notes their therapist chooses to share.

The whole app runs locally **without any external credentials** using `DEMO_MODE=true` (see [Demo mode](#demo-mode)).

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Folder structure](#folder-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Demo mode](#demo-mode)
- [Demo credentials](#demo-credentials)
- [API overview](#api-overview)
- [Real-time events](#real-time-events)
- [Testing and quality checks](#testing-and-quality-checks)
- [Known limitations](#known-limitations)
- [Future enhancements](#future-enhancements)

---

## Features

**1. Therapist profile and branded link**
- Registration/login (JWT), editable profile (photo upload, bio, specializations, languages, qualifications, timezone, GSTIN, services with durations and prices).
- Public profile at `/<slug>` (e.g. `/arpit-shukla`) with live slug-availability check.
- Crawler-friendly share link `<API_PUBLIC_URL>/share/<slug>` that serves Open Graph tags for WhatsApp/LinkedIn previews, then redirects humans to the React profile.
- Public enquiry form and a directory enquiry endpoint whose leads are routed by `leadDistributionService`.

**2. Timezone-aware scheduling**
- Weekly availability windows (validated for overlaps), blocked dates/times, 30/45/60/90-minute services.
- Slots are generated in the therapist's timezone and displayed in the client's chosen timezone (`date-fns-tz`).
- **Double-booking is prevented in the database**: each session reserves fixed-step `slot_keys` protected by a unique partial index, so concurrent bookings for overlapping times fail with `409 Conflict`.
- Unpaid bookings hold the slot for `PAYMENT_HOLD_MINUTES`, after which a background job releases them. A 24-hour reminder job runs on the same scheduler.
- Waitlist (Professional plan and up), therapist calendar (`react-big-calendar`), and session status updates (completed / no-show / cancelled).

**3. Client CRM, intake and consent**
- Client list with search, status/tag filters, sorting, and active-client capacity tied to the plan.
- Client detail with intake answers, versioned consent audit (timestamp + version), sessions, payments, notes and packages.
- Clients are invited by email with a single-use token; the client portal blocks booking until intake and consent are complete.

**4. Payments, packages and invoices**
- Razorpay Orders + Checkout (test mode) with **server-side signature verification** and an HMAC-verified **webhook** (`payment.captured` / `payment.failed`) checked against the raw request body.
- All money is stored in **integer paise**. GST (`GST_RATE_PERCENT`) is added on top of the fee; the plan's platform fee is deducted from the therapist's net.
- Session packages (3/6/12 sessions, configurable) with credits consumed on booking.
- GST invoice PDFs (`pdfkit`) downloadable by the therapist and the paying client only.

**5. Clinical notes**
- Rich-text editor (TipTap) with freeform notes plus SOAP/DAP templates (Professional plan and up).
- Every note is **private by default**. Only notes the therapist explicitly marks *shared* are visible to the client.
- Private notes are never returned through any client-facing route: the portal query filters on `visibility: 'shared'` and the client serializer throws if it is ever handed a private note. HTML is sanitized server-side.

**6. Chat and notifications**
- Socket.io chat between a therapist and each of their clients, with typing indicators, read receipts, unread counts and REST fallback.
- In-app notifications (bookings, payments, cancellations, reminders, new enquiries) pushed live, plus email and WhatsApp via provider interfaces.

**7. Entitlements and plans**
- A single `entitlementService.canAccess(therapistId, featureKey)` backs every gated route (`requireFeature` middleware) and the frontend `useEntitlement` hook. No route or component checks tier names.
- Plans live in the `SubscriptionTierConfig` collection, seeded from `src/config/subscriptionTiers.json`: prices, platform fees, client caps and feature flags are all configuration.
- Blocked actions return `403` with `code: "UPGRADE_REQUIRED"`, and the UI shows an upgrade prompt.

| Plan | Monthly | Platform fee | Active clients | Adds |
| --- | --- | --- | --- | --- |
| Starter (`free`) | ₹0 | 5% | 5 | Chat, branded link, freeform notes, basic analytics |
| Professional (`pro`) | ₹999 | 3% | 50 | SOAP/DAP templates, packages, waitlist |
| Practice+ (`premium`) | ₹2,499 | 2% | Unlimited | Advanced analytics |

**8. Analytics**
- All metrics are computed with **MongoDB aggregation pipelines**: revenue trend (gross vs net), sessions, clients by status, no-show rate.
- Advanced analytics (Practice+): revenue by purpose, no-show trend, new clients, top clients, busiest slots, package utilisation.

**9. Client portal**
- Separate `client` JWT role bound to exactly one therapist (`tid` claim). Every portal query is scoped to that client and therapist, so clients can never reach another client's or another therapist's data.
- Onboarding checklist, booking with pay-now or package credits, pay-later retry, cancellation, packages, payment history with invoices, shared notes, and messages.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4, Axios, Socket.io client, react-hook-form, react-big-calendar, TipTap 3, Recharts 3, lucide-react |
| Backend | Node.js (>= 18), Express 5, Mongoose 9, Socket.io 4, express-validator, jsonwebtoken, bcryptjs, multer, pdfkit, sanitize-html, date-fns-tz |
| Database | MongoDB (Atlas or local); `mongodb-memory-server` in demo mode |
| Integrations | Razorpay (test mode), Nodemailer, WhatsApp provider interface, local/S3 storage |
| Tooling | `node:test` API tests, ESLint 10 (frontend) |

---

## Architecture

```
React SPA (Vite)  ── Axios (JWT Bearer) ──►  Express REST API  ──►  MongoDB (Mongoose)
       │                                         │
       └──── Socket.io client ◄── JWT auth ──► Socket.io server (chat + notifications)
                                                 │
                                    Service layer (third-party integrations isolated)
                                    ├─ paymentGatewayService  → Razorpay | demo gateway
                                    ├─ emailService           → SMTP | console stub
                                    ├─ whatsappService        → stub queue
                                    ├─ storageService         → local disk | S3
                                    ├─ entitlementService     → SubscriptionTierConfig
                                    ├─ bookingService / slotService (timezones, slot_keys)
                                    ├─ leadDistributionService
                                    └─ schedulerService       (hold expiry, reminders)
```

Key design decisions:

- **Controllers stay thin**; business rules live in `services/`. Third-party providers sit behind small interfaces so the demo stubs and the real providers are interchangeable.
- **Authorization is enforced in the API**: `protect` + `requireRole('therapist' | 'client')` middleware, every query scoped by `therapist_id` (and `client_id` for portal routes), plus role-specific serializers (`serializeNoteForClient`, `serializePaymentForClient`).
- **Socket rooms** are `user:<role>:<id>` and `conversation:<therapistId>:<clientId>`. Joining is authorized on the server.
- **Configuration-driven**: prices, GST, hold window, slot step, package sizes, plans, caps and features all come from env or `SubscriptionTierConfig`.

---

## Folder structure

```
Unfazed/
├── unfazed-backend/
│   ├── server.js                 # HTTP + Socket.io bootstrap, DB connect, seed, scheduler
│   ├── scripts/seed.js           # Seed a real database on demand
│   ├── tests/api.test.js         # End-to-end API tests (in-memory MongoDB)
│   └── src/
│       ├── app.js                # Express app, CORS, routes, /api/health, /share/:slug
│       ├── config/               # env, db (incl. in-memory), razorpay, consent text, subscriptionTiers.json
│       ├── models/               # Therapist, Client, Session, Availability, Waitlist, Payment, Package,
│       │                         # ClientPackage, SessionNote, Message, Notification, Lead, SubscriptionTierConfig
│       ├── controllers/          # Request handlers per module
│       ├── routes/               # auth, public, therapists, clients, scheduling, payments, notes,
│       │                         # analytics, chat, leads, entitlements, notifications, portal
│       ├── middleware/           # authMiddleware, entitlementMiddleware, validate, errorHandler
│       ├── services/             # booking, slot, payment, paymentGateway, invoice, entitlement, email,
│       │                         # whatsapp, storage, notification, chat, client, leadDistribution, scheduler
│       ├── sockets/chatSocket.js
│       └── utils/                # ApiError, asyncHandler, money, serializers, generateSlug, seed
└── unfazed-frontend/
    └── src/
        ├── api/                  # Axios instance + one module per API area
        ├── components/           # common UI, layout, scheduling, crm, notes, chat, payments, analytics
        ├── context/              # Auth, Socket, Entitlement, Toast providers
        ├── hooks/                # useApi, useEntitlement, ...
        ├── pages/                # auth, public, therapist/*, client/*
        ├── routes/               # AppRoutes (lazy-loaded) + role guards
        └── utils/                # formatting (money, dates, timezones)
```

---

## Getting started

### Prerequisites

- Node.js 18+ (developed on Node 24) and npm.
- Nothing else is needed for demo mode. MongoDB, Razorpay, SMTP and AWS are optional.

### 1. Backend

```bash
cd unfazed-backend
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run dev                 # or: npm start
```

With the default `.env` (`DEMO_MODE=true`, empty `MONGO_URI`) the API starts on `http://localhost:5000`, launches an in-memory MongoDB and seeds demo data. Check `http://localhost:5000/api/health`.

> The first run downloads a MongoDB binary for `mongodb-memory-server` (about 100 MB, cached afterwards).

### 2. Frontend

```bash
cd unfazed-frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

### Using real services

| Want | Set |
| --- | --- |
| Persistent database | `MONGO_URI=mongodb+srv://...` (seed once with `npm run seed`, or keep `SEED_ON_START=true` for an empty DB) |
| Real Razorpay test payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; point a Razorpay webhook (e.g. via ngrok) at `POST /api/payments/webhook` |
| Real email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` |
| S3 storage | `STORAGE_DRIVER=s3`, `AWS_*` variables, and `npm install @aws-sdk/client-s3` |
| Production | `DEMO_MODE=false`, a strong `JWT_SECRET`, `NODE_ENV=production`, correct `CLIENT_URL` / `API_PUBLIC_URL` |

With `DEMO_MODE=false`, the server refuses to start without `MONGO_URI` and `JWT_SECRET`, and online payments return `503 PAYMENTS_UNAVAILABLE` until Razorpay keys are configured. Nothing is silently simulated.

---

## Environment variables

### Backend (`unfazed-backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | API port |
| `NODE_ENV` | `development` | Environment |
| `CLIENT_URL` | `http://localhost:5173` | Frontend origin (CORS, invite links, share redirects) |
| `API_PUBLIC_URL` | `http://localhost:5000` | Public API URL (share links, uploaded file URLs) |
| `CORS_EXTRA_ORIGINS` | – | Comma-separated extra allowed origins |
| `MONGO_URI` | – | MongoDB connection string. Empty + demo mode means an in-memory DB |
| `DEMO_MODE` | `false` (`true` in `.env.example`) | Enables simulated fallbacks (see below) |
| `SEED_ON_START` | = `DEMO_MODE` | Seed demo data when the DB is empty |
| `DEMO_PASSWORD` | `Demo@1234` | Password for seeded accounts |
| `JWT_SECRET` | – | Token signing secret (required unless demo mode) |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | – | Razorpay test keys |
| `RAZORPAY_WEBHOOK_SECRET` | – | Webhook HMAC secret |
| `CURRENCY` | `INR` | Currency |
| `GST_RATE_PERCENT` | `18` | GST added to session/package fees |
| `DEFAULT_SESSION_PRICE_INR` | `1500` | Default service price |
| `PACKAGE_SIZES` | `3,6,12` | Allowed package sizes |
| `SESSION_DURATIONS` | `30,45,60,90` | Allowed service durations (minutes) |
| `PAYMENT_HOLD_MINUTES` | `15` | How long an unpaid booking holds its slot |
| `SLOT_STEP_MINUTES` | `30` | Slot grid / double-booking key granularity |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | – | Nodemailer SMTP. Empty host means console stub |
| `WHATSAPP_PROVIDER` | `stub` | WhatsApp provider (only `stub` implemented) |
| `STORAGE_DRIVER` | `local` | `local` or `s3` |
| `STORAGE_LOCAL_DIR` | `uploads` | Local storage folder |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | – | S3 credentials |
| `SCHEDULER_INTERVAL_SECONDS` | `60` | Hold-expiry / reminder job interval |

### Frontend (`unfazed-frontend/.env`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | API base URL including `/api` (default `http://localhost:5000/api`) |
| `VITE_SOCKET_URL` | Optional Socket.io URL (defaults to the API origin) |
| `VITE_RAZORPAY_KEY_ID` | Optional **public** Razorpay key id. Secrets never go in the frontend |

---

## Demo mode

`DEMO_MODE=true` lets the full product run with **no external accounts**. Real business logic (authorization, entitlements, double-booking, GST maths, signature checks, aggregations, privacy rules) runs exactly as in production; only the external providers are replaced:

| Area | Real behaviour | Simulated in demo mode |
| --- | --- | --- |
| Database | MongoDB via `MONGO_URI` | `mongodb-memory-server` in-process MongoDB (real Mongo engine, including unique indexes and aggregations), **wiped on every restart** and re-seeded |
| Seed data | `npm run seed` on demand | Auto-seeded: 2 therapists, 15 clients, ~150 sessions, ~150 payments, packages, notes, chats, leads |
| JWT secret | `JWT_SECRET` | If unset, an ephemeral random secret is generated per process (everyone is logged out on restart) |
| Payments | Razorpay Orders + Checkout, signature verification, webhook | **Demo gateway**: creates `order_demo_*` orders; the "Pay" button asks the server to simulate checkout, which returns a payment id **HMAC-signed with a per-process secret**; that signature then goes through the same `verifyAndCapture` path as Razorpay before the payment is marked paid. "Simulate failure" exercises the failure path and releases the slot hold. **No money moves.** The simulate endpoint is rejected unless `DEMO_MODE=true`. |
| Webhook | Razorpay → `POST /api/payments/webhook` | Same endpoint and HMAC verification; exercised by the automated tests with a test secret |
| Plan billing | (No SaaS billing in scope) | Changing plan in *Settings → Plan* switches tier instantly without charging (`simulated_billing: true`) |
| Email | Nodemailer SMTP | Logged to the console as `[email:stub] to=... subject=...` (invites, booking/payment confirmations, reminders) |
| WhatsApp | Business API (future) | `[whatsapp:stub]` log line plus an in-memory queue |
| File storage | AWS S3 | Local `./uploads` folder; avatars served from `/uploads/public`, invoices only through authorized routes |

The UI labels simulated pieces: the checkout modal shows "Demo payment gateway", and *Settings → Integrations* shows each provider's live status from `/api/health`.

---

## Demo credentials

All seeded accounts use the password **`Demo@1234`** (configurable via `DEMO_PASSWORD`).

All seeded people, sessions, notes, payments and messages are fictional sample data. The default "Arpit Shukla" profile is a software demonstration of the platform and does not represent a licensed or practising healthcare professional.

| Role | Email | Notes |
| --- | --- | --- |
| Therapist | `arpit.shukla@unfazed.demo` | Arpit Shukla (default demo therapist), **Professional** plan, rich data, public page `/arpit-shukla` |
| Therapist | `dr.iyer@unfazed.demo` | **Starter** plan at the 5-client cap: use it to see upgrade prompts and locked features |
| Client | `aarav@client.demo` | Arpit Shukla's client: sessions, package credits, shared + private notes, chat |
| Client | `priya@client.demo` | Arpit Shukla's client (used-up 3-session package) |
| Client | `kavya@client.demo` | Client of Dr. Iyer |

Therapists sign in at `/login`; clients sign in at `/portal/login`.

**Suggested demo walkthrough**
1. Log in as Arpit Shukla → Dashboard, Schedule, Clients → open Aarav → Notes (note the private vs shared toggle).
2. In another browser profile, log in as Aarav → Shared notes (only shared notes appear), then book a session next week → pay with the demo gateway → the invoice appears under Payments and Arpit Shukla gets a live notification.
3. Chat between the two windows in real time.
4. Log in as Dr. Iyer → Add client is blocked at 5/5, Packages and Advanced analytics are locked. Switch plan in Settings → Plan and the features unlock.

---

## API overview

Base URL: `http://localhost:5000/api`. Send `Authorization: Bearer <token>` for protected routes. Responses are `{ success, ... }`; errors are `{ success: false, message, code?, errors? }`.

| Area | Endpoints |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/client/register`, `POST /auth/client/login`, `GET /auth/invite/:token`, `POST /auth/invite/:token/accept`, `GET /auth/me` |
| Public | `GET /public/therapists/:slug`, `GET /public/therapists/:slug/slots`, `POST /public/therapists/:slug/enquiries`, `POST /public/leads`, `GET /public/payments/config` |
| Therapist profile | `GET/PUT /therapists/me`, `POST /therapists/me/photo`, `GET /therapists/slug-available` |
| Clients (CRM) | `GET/POST /clients`, `GET/PUT /clients/:id`, `POST /clients/:id/invite` |
| Scheduling | `GET/PUT /scheduling/availability`, `POST /scheduling/availability/blocked`, `DELETE /scheduling/availability/blocked/:blockId`, `GET /scheduling/slots`, `GET/POST /scheduling/sessions`, `PATCH /scheduling/sessions/:id/status`, `GET /scheduling/waitlist` |
| Payments | `GET /payments`, `GET /payments/summary`, `GET/POST /payments/packages`, `PUT /payments/packages/:id`, `GET /payments/client-packages`, `GET /payments/:id/invoice`, `POST /payments/webhook` (Razorpay, HMAC) |
| Notes | `GET/POST /notes`, `GET/PUT/DELETE /notes/:id` |
| Chat | `GET /chat/conversations`, `GET/POST /chat/conversations/:clientId/messages` |
| Leads | `GET /leads`, `PATCH /leads/:id`, `POST /leads/:id/convert` |
| Entitlements | `GET /entitlements`, `GET /entitlements/tiers`, `POST /entitlements/change-tier` |
| Analytics | `GET /analytics/overview`, `GET /analytics/advanced` (Practice+) |
| Notifications | `GET /notifications`, `PATCH /notifications/read-all`, `PATCH /notifications/:id/read` |
| Client portal (`client` role) | `GET/PUT /portal/me`, `PUT /portal/intake`, `GET/POST /portal/consent`, `GET /portal/slots`, `GET/POST /portal/sessions`, `POST /portal/sessions/:id/cancel`, `POST /portal/waitlist`, `GET /portal/packages`, `POST /portal/packages/:id/purchase`, `GET /portal/payments`, `POST /portal/payments/:id/checkout`, `POST /portal/payments/verify`, `POST /portal/payments/:id/demo-complete` (demo only), `GET /portal/payments/:id/invoice`, `GET /portal/notes` (shared only), `GET/POST /portal/messages` |

Outside `/api`: `GET /share/:slug` (Open Graph share page) and `GET /uploads/public/*` (avatars).

Notable status codes: `401` unauthenticated, `403` wrong role or `UPGRADE_REQUIRED`, `404` resources belonging to another therapist or client (no existence leaks), `409` slot conflict, `400` validation (with per-field `errors`), `INTAKE_REQUIRED` / `CONSENT_REQUIRED` for un-onboarded clients.

---

## Real-time events

Socket.io connects with the same JWT (`auth: { token }`).

| Event | Direction | Purpose |
| --- | --- | --- |
| `chat:join` / `chat:leave` | client → server | Enter or leave a conversation room (authorized server-side) |
| `chat:send` | client → server (ack) | Send a message; persisted, then broadcast |
| `chat:message` | server → client | New message |
| `chat:typing` | both | Typing indicator |
| `chat:read` | both | Read receipts |
| `chat:unread` | server → client | Updated unread counts |
| `notification:new` | server → client | In-app notification |

---

## Testing and quality checks

```bash
cd unfazed-backend && npm test        # 15 end-to-end API tests on an in-memory MongoDB
cd unfazed-frontend && npm run lint   # ESLint (react-hooks, react-refresh)
cd unfazed-frontend && npm run build  # Production build (route-level code splitting)
```

The API tests cover:
- authentication and role separation;
- therapist data isolation;
- **private notes never reaching clients**;
- double-booking (`409`);
- timezone slot generation;
- entitlement blocks and client caps;
- intake/consent gating;
- demo payments with signature verification and GST invoice PDFs;
- package purchase and credit use;
- webhook signature rejection and acceptance;
- lead distribution and conversion;
- availability validation.

---

## Known limitations

- Demo mode data lives in memory and resets on every backend restart; demo JWTs also become invalid after a restart unless `JWT_SECRET` is set.
- The WhatsApp integration is a stub: no Business API provider is wired up yet.
- Plan changes are simulated; there is no SaaS subscription billing or proration.
- S3 storage requires installing the optional `@aws-sdk/client-s3` package; without it the server falls back to local storage.
- Video sessions are out of scope: sessions are booked online, but the video call happens on the therapist's own platform.
- The scheduler runs in-process; a multi-instance deployment would need a shared job queue and a Socket.io adapter (e.g. Redis).

---

## Future enhancements

- Razorpay Subscriptions for SaaS plan billing, and Razorpay Route for therapist payouts.
- WhatsApp Business API (e.g. Gupshup or Meta Cloud API) for reminders and confirmations.
- Integrated video sessions (Jitsi / Daily) with join links in reminders.
- Google Calendar two-way sync and recurring sessions.
- Client-facing assessments (PHQ-9, GAD-7) with progress charts.
- Two-factor authentication, audit logs and field-level encryption for clinical notes.
- Multi-therapist clinics with roles, and redundancy (Redis adapter, job queue) for horizontal scaling.

# AyosDito

**May sira? May maaasahang aayos!**

AyosDito is a local services marketplace MVP for the Philippines. A customer describes a home-service problem, approved providers who cover the category and location send quotes, and the customer compares and accepts one quote. The selected provider completes the job, and the customer can leave one review after completion. Administrators review provider applications and verification requests, moderate reviews, handle reports, and manage the category and location catalog.

This repository contains a complete full-stack application: a React single-page app, an Express REST API, a Prisma data model, a demo seed, integration and browser tests, and deployment notes.

> **Current status:** this is a working, locally verified MVP. It is **not deployed**, there is **no live URL**, no payment processing, and no external email, maps, SMS, or AI service is configured. Demo records are clearly labeled. See [Verification status](#verification-status) and [Known limitations](#known-limitations).

---

## Contents

- [What works](#what-works)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [How the marketplace works](#how-the-marketplace-works)
- [Roles and permissions](#roles-and-permissions)
- [Security and privacy](#security-and-privacy)
- [Data model](#data-model)
- [Scripts](#scripts)
- [Testing](#testing)
- [Deployment](#deployment)
- [Verification status](#verification-status)
- [Implemented features](#implemented-features)
- [Known limitations](#known-limitations)
- [Documentation](#documentation)

---

## What works

### Public marketplace

- Responsive home, services, provider directory, provider profile, how-it-works, for-providers, terms, and privacy pages.
- Provider directory with keyword, category, location, minimum/maximum price, minimum rating, verification-state, sorting, and pagination filters.
- Search only returns approved, active providers with at least one active service listing in an active category and at least one active service area.
- Location matching understands the seeded hierarchy (`region → province → city → barangay`), so a provider covering a city is relevant to a barangay request and vice versa.
- Provider profiles show services and prices, service areas, portfolio images, completed-job count, visible reviews, and verification state. A profile without an approved check says so plainly.
- Customers can save providers to a favorites list and can report a review or an entire provider profile.
- Sample data is visibly marked. The site does not invent ratings, review counts, or customer statistics.

### Accounts and access

- Customer and provider self-registration; public registration cannot create an administrator.
- HTTP-only session cookie login/logout; server-side role and account-status checks for every protected operation.
- Email verification and resend, password reset, and password change (the change-password form is currently on the customer profile screen).
- Protected routes for customers, providers, and administrators.
- Suspended accounts lose active sessions and cannot sign in.
- Password reset revokes all sessions; changing a password revokes the other sessions.

### Customer workflow

- Customer dashboard with request, quote, and favorite counts.
- Create a service request with category, location, description, optional preferred schedule, and optional target provider.
- Request filters and pagination, quote comparison, quote acceptance, and quote decline.
- Request lifecycle: `PENDING → RESPONDED → ACCEPTED → IN_PROGRESS → COMPLETED`, plus `CANCELLED` and `DECLINED`.
- Customer email is hidden from providers until a quote is accepted.
- One review per completed request, by the request owner only, after completion.

### Provider workflow

- Provider dashboard with approval status, verification status, profile-completeness prompts, open opportunities, active jobs, completed jobs, pending quotes, and recent reviews.
- Matching request inbox: approved providers see only open requests in an active category they list and within their service-area scope, and only if they have not already quoted.
- Quote creation and editing while the request is open; one quote per provider per request.
- Start an accepted job, then mark it completed.
- Services and pricing management, service-area selection, profile editing, avatar upload, and up to 12 portfolio images.
- Identity and business verification requests. A provider account never receives a verification badge automatically.
- Public responses to visible reviews.
- Pending or rejected providers can prepare their profile but cannot quote or appear in public discovery.

### Administrator workflow

- Platform overview with request counts by status, pending providers, open reports, and recent audit entries.
- Provider approval queue with approve/reject actions and rejection reasons.
- Verification review queue; approving a badge requires an approved provider.
- User list with search and filters, suspend/reactivate actions, and controlled promotion of a verified customer to administrator.
- Review moderation (visible/hidden) with rating recomputation.
- Report queue for provider and review reports, with resolve/dismiss and resolution notes.
- Category management and hierarchical location management.
- Audit log of administrative actions.
- Server-side authorization on every administrative endpoint.

### Engineering

- Shared Zod validation contracts used by the API and the client.
- REST API with consistent success/error envelopes, pagination metadata, request IDs, rate limiting, CSRF protection, and normalized error codes.
- PostgreSQL-portable Prisma schema; SQLite is used locally and in the test suite.
- Demo seed with labeled demo accounts, providers, requests, quotes, and reviews.
- Server integration tests, client unit/component tests, and Playwright browser tests at desktop and mobile viewports.
- `.env.example`, setup, API, deployment, testing, feature, and limitation documentation.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Client | React 18, TypeScript, Vite 5, React Router 6, TanStack Query 5, react-hook-form, Zod, Tailwind CSS 3 |
| UI | Custom warm-paper/teal design system, Lucide icons, Radix Dialog, Sonner toasts |
| Server | Node.js 20+, Express 4, TypeScript, Zod, Prisma 6 |
| Database | SQLite for local development and tests; schema designed for PostgreSQL (see [deployment](docs/DEPLOYMENT.md)) |
| Auth | Opaque random session tokens stored as HMAC-SHA256 hashes, HTTP-only cookies, bcrypt password hashes, CSRF double-submit cookie |
| Uploads | Multer in-memory handling, magic-byte validation, random filenames, local disk storage |
| Tests | Vitest, Supertest, Testing Library, jsdom, Playwright (Chromium, desktop and mobile projects) |

Money is stored and transported as **integer centavos**. The UI converts to pesos for display and input. This avoids floating-point rounding errors.

---

## Repository layout

```text
.
├── client/                 React SPA
│   ├── src/
│   │   ├── auth/           Session provider and route guard
│   │   ├── components/     Layout, UI, provider, dashboard components
│   │   ├── pages/          Public, auth, customer, provider, admin pages
│   │   └── lib/            API client, formatting, query keys, helpers
│   └── vite.config.ts      Dev proxy for /api and /uploads
├── server/                 Express API
│   ├── prisma/
│   │   ├── schema.prisma   Normalized data model
│   │   ├── migrations/     SQLite migration for local development
│   │   └── seed.ts         Administrator, catalog, and demo seed
│   ├── src/
│   │   ├── routes/         Auth, catalog, providers, requests, quotes, admin, ...
│   │   ├── middleware/     Session, CSRF, rate limits, request context, errors
│   │   ├── services/       Matching, locations, provider statistics
│   │   └── lib/            Hashing, sessions, images, mail, serialization
│   └── tests/              Vitest/Supertest integration tests
├── shared/                 Shared Zod contracts and API DTO types
├── e2e/                    Playwright tests and demo-account helpers
├── docs/                   API, deployment, and testing documentation
├── .env.example            Environment template (copy to server/.env)
├── playwright.config.ts    Desktop 1440×900 and mobile 390×844 projects
└── package.json            npm workspaces and root scripts
```

The API client always calls the relative `/api` path. In development, Vite proxies `/api` and `/uploads` to the API server. In production, the recommended setup is one origin: Express serves the built client and the API.

---

## Quick start

### Prerequisites

- Node.js **20.19 or newer** (the repository declares this in `package.json`).
- npm (bundled with Node.js).
- Git Bash, bash, or another shell. On Windows PowerShell, use `Copy-Item` instead of `cp`.

### 1. Install dependencies

```bash
npm install
```

### 2. Create the server environment file

```bash
cp .env.example server/.env
```

`server/.env` is ignored by Git. Never commit it.

### 3. Set a session secret and local passwords

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Put the result in `server/.env` as `SESSION_SECRET`. Review `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD`, and `SEED_DEMO_DATA` while you are there. The included values are local demo values only; change them before anyone else can reach the app.

### 4. Create the database and seed it

```bash
npm run db:deploy
npm run db:seed
```

Or run the combined setup script:

```bash
npm run setup
```

`setup` runs `npm install`, applies migrations, and seeds. The seed creates:

- the administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD`;
- the categories and location hierarchy;
- when `SEED_DEMO_DATA=true` and `NODE_ENV` is not `production`, labeled demo customers, providers, services, requests, quotes, and reviews.

Demo content is intentionally skipped in production, regardless of the flag.

### 5. Run the app

```bash
npm run dev
```

- Web app: <http://localhost:5173>
- API: <http://localhost:4000>
- Health check: <http://localhost:4000/api/health>

Both servers run together. If port 4000 or 5173 is already in use, stop the other process or change `PORT` / the Vite port.

### Local database commands

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:deploy` | Apply existing migrations (safe for a fresh database) |
| `npm run db:push` | Push the schema without creating a migration (prototyping only) |
| `npm run db:seed` | Insert missing seed records; does not wipe existing data |
| `npm run db:reset` | **Destructive:** drop the local database, reapply migrations, and reseed |

`npm run db:reset` deletes local data in `server/prisma/dev.db` and is intended only for development. The test suite uses a separate `server/prisma/test.db`.

### Resetting the demonstration

If you have been clicking around and want the documented demo state back:

```bash
npm run db:reset
```

Run this only when you do not need the current local data. The seed is not a backup or migration tool.

---

## Demo accounts

The seed creates the following accounts. All demo customer and provider accounts use `DEMO_PASSWORD` from `server/.env` (default in `.env.example`: `Demo1234!`).

| Role | Name | Email | Password |
| --- | --- | --- | --- |
| Customer | Maria Santos | `customer.maria@ayosdito.test` | `DEMO_PASSWORD` |
| Provider | Jose Ramirez / Malolos Laptop Care | `provider.laptopcare@ayosdito.test` | `DEMO_PASSWORD` |
| Administrator | Configured administrator | `ADMIN_EMAIL` | `ADMIN_PASSWORD` |

With the values in `.env.example`, the administrator is `admin@ayosdito.test` / `Admin123!demo`. Those values are **development placeholders**, not production credentials.

Additional seeded accounts, all using `DEMO_PASSWORD`:

- Customers: Carlo Reyes (`customer.carlo@ayosdito.test`), Ana Dela Cruz (`customer.ana@ayosdito.test`).
- Providers: Meycauayan HomeFix (`provider.homefix@ayosdito.test`), Bulacan Cool Air Services (`provider.coolair@ayosdito.test`), Bulacan Home Works (`provider.homeworks@ayosdito.test`), and Wired WiFi Tech (`provider.wiredwifi@ayosdito.test`), which is waiting for administrator approval.

These email addresses are fictional and cannot receive mail. Demo accounts are marked `isDemo`; demo providers, requests, and related reviews are identified in the interface so they cannot be mistaken for real marketplace activity.

If you change `DEMO_PASSWORD` or `ADMIN_PASSWORD` after seeding, the existing password hashes are not updated by another seed run. Reset the local database or use the password-reset flow to rotate them.

### Testing the email flows without SMTP

SMTP is not configured by default, so **no email is sent**. In non-production environments the API logs the verification or reset link and returns it in the response:

- Customer/provider registration returns `devVerificationUrl`.
- `POST /api/auth/resend-verification` returns `devVerificationUrl`.
- `POST /api/auth/forgot-password` returns `devResetUrl` for an existing active account.

Production never returns or logs these links. Configure SMTP before relying on email verification or password reset in production. See [deployment](docs/DEPLOYMENT.md#5-email).

---

## Environment variables

The API loads `server/.env` when started from the `server` workspace. Start with `.env.example`; never commit real values.

| Variable | Default / example | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, or `production`. Production enables stricter config checks and HTTP security headers. |
| `PORT` | `4000` | API port. |
| `DATABASE_URL` | `file:./dev.db` | Prisma database URL. Relative SQLite paths resolve under `server/prisma`. |
| `APP_BASE_URL` | `http://localhost:5173` | Public web URL used in verification and reset links. No trailing slash needed. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed browser origins. Wildcards are rejected in production. |
| `SESSION_SECRET` | placeholder | **Required in production.** Keys the HMAC hash of session tokens. Use a long random value. |
| `BCRYPT_ROUNDS` | `12` | Password-hashing cost. Tests use a lower value automatically. |
| `SESSION_TTL_DAYS` | `7` | Session lifetime in days. |
| `COOKIE_SECURE` | `false` | Set to `true` behind HTTPS. It is forced on in production. Use a single HTTPS origin; the current cookie policy is `SameSite=Lax`. |
| `UPLOAD_DIR` | `./uploads` | Directory for avatar and portfolio images, resolved from the server working directory. |
| `MAX_UPLOAD_MB` | `5` | Per-image upload limit. |
| `CLIENT_DIST` | optional | Overrides the built client directory. Defaults to `../client/dist` from the server directory. |
| `ADMIN_EMAIL` | `admin@ayosdito.test` | Email for the seeded administrator. |
| `ADMIN_PASSWORD` | placeholder | Password for the seeded administrator. Required when seeding production. |
| `ADMIN_NAME` | `AyosDito Admin` | Display name for the seeded administrator. |
| `SEED_DEMO_DATA` | `true` | Seeds demo marketplace content outside production. |
| `DEMO_PASSWORD` | `Demo1234!` | Shared password for seeded demo customers and providers. |
| `SMTP_HOST` | empty | SMTP server. When empty, no email is sent and a warning is logged. |
| `SMTP_PORT` | `587` | SMTP port. |
| `SMTP_SECURE` | `false` | Use TLS on connect (usually `true` for port 465). |
| `SMTP_USER` / `SMTP_PASS` | empty | SMTP credentials, if required by the server. |
| `MAIL_FROM` | `AyosDito <no-reply@localhost>` | From address for verification and reset messages. |

Production startup fails when `SESSION_SECRET` is missing, too short, or still contains `replace`, or when `CORS_ORIGINS` contains `*`. Seeding production also requires `ADMIN_PASSWORD`.

---

## How the marketplace works

### Request lifecycle

```text
PENDING ──provider quotes──> RESPONDED ──customer accepts──> ACCEPTED
   │                              │                            │
   │                              │                            └──provider starts──> IN_PROGRESS
   │                              │                                                   │
   │                              │                                                   └──provider completes──> COMPLETED
   │                              │                                                                                 │
   │                              └──all quotes declined──> DECLINED                                                  └──one customer review
   │
   └──────────────────────────── customer can cancel ────────────────────────────────> CANCELLED
```

Rules enforced by the API:

- Only a customer can create a request, cancel it, accept a quote, decline a quote, or review it.
- Only an approved provider whose active listings cover the request category and whose active service areas overlap the request location can quote. A targeted request is visible only to that provider (plus the customer and administrators).
- A provider gets one quote per request. Quotes can be edited only while both the quote and request are open.
- Accepting one quote accepts it atomically and declines the other pending quotes. Only a request in `RESPONDED` can accept or decline quotes.
- The assigned provider moves `ACCEPTED → IN_PROGRESS → COMPLETED`.
- Cancelling a `PENDING`, `RESPONDED`, or `ACCEPTED` request sets it to `CANCELLED` and declines still-pending quotes.
- If the customer declines every quote, the request becomes `DECLINED`.
- A review requires a `COMPLETED` request with an assigned provider. It can be submitted once, only by the request owner.
- Cancellation after acceptance is not a refund or dispute process; AyosDito does not handle payments.

### Provider discovery and matching

The public directory only exposes providers that are all of the following:

- approved by an administrator,
- owned by an active user with the provider role,
- have at least one active listing in an active category,
- have at least one active service area.

The provider request inbox uses the same category and location scope. Requests with a `targetProviderId` are excluded from other providers' opportunity lists. Quoted requests leave the opportunity list.

The location scope includes ancestors and descendants of the selected place, which allows city-level coverage and barangay-level requests to match one another.

### Ratings

- Ratings are whole numbers from 1 to 5.
- Provider rating averages and review counts are recalculated whenever a review is created or its visibility changes.
- Filtering by `minRating` or sorting by rating only considers providers with at least three visible reviews, so a new provider with a single 5-star review is not presented as “best rated.”
- Hidden reviews do not contribute to public ratings or review lists.
- No provider statistics or reviews are fabricated by the application outside the clearly labeled demo seed.

### Verification

Provider approval and verification are separate:

1. A provider registers and sets up a profile. Its application starts as `PENDING`.
2. An administrator approves or rejects the provider application.
3. An approved provider can submit an identity and/or business verification request with a written note describing what can be checked.
4. An administrator records the decision after checking outside the application. Only the administrator's approval sets the verification timestamp and public badge.
5. Registration, account approval, or a demo flag never grants a verification badge.

The MVP intentionally does **not** collect or store identity documents. A verification note is not proof of identity, and the public UI reflects only the recorded administrative decision.

---

## Roles and permissions

| Area | Guest | Customer | Provider | Administrator |
| --- | --- | --- | --- | --- |
| Browse services, directory, profiles, reviews | Yes | Yes | Yes | Yes |
| Create an account | Customer/provider only | — | — | — |
| Favorites | — | Own list | — | — |
| Create/cancel request | — | Own requests | — | — |
| View request details | — | Own requests | Matching open requests, quoted requests, assigned jobs | Any request through the API |
| Quote on request | — | — | Approved, matching, not yet quoted | — |
| Accept/decline quote | — | Own request | — | — |
| Start/complete job | — | — | Assigned jobs | — |
| Review | — | Own completed request, once | — | — |
| Provider services/profile/uploads | — | — | Own profile | — |
| Verification request | — | — | Own approved provider account | — |
| Admin dashboard, approvals, moderation, reports, catalog, audit | — | — | — | Yes |
| Grant administrator | — | — | — | Server-checked, active verified customer only |

Access is enforced by API middleware and route logic. Client-side route guards improve the experience but are not the security boundary.

---

## Security and privacy

### Authentication and request security

- Passwords are hashed with bcryptjs. Plain-text passwords are never stored.
- Session tokens are random 256-bit values; only an HMAC-SHA256 hash is stored in the database. The raw token lives in the HTTP-only `ayos_session` cookie.
- Cookies use `SameSite=Lax` and `Secure` in production. The supported deployment is a single HTTPS origin.
- Unsafe methods (`POST`, `PUT`, `PATCH`, `DELETE`) require a double-submit CSRF token: the non-HTTP-only `ayos_csrf` cookie and the matching `X-CSRF-Token` header.
- The API rejects unsafe requests from origins not listed in `CORS_ORIGINS` or the request's own origin.
- CORS uses an explicit allowlist with credentials; production rejects `*`.
- Rate limits: general API 900 requests per 15 minutes per client, authentication 30 per 15 minutes, recovery requests 10 per hour, writes 180 per 15 minutes. Limits are in-memory and per process; see limitations.
- Request IDs are returned in the `X-Request-Id` header and in error envelopes for troubleshooting.
- Production adds Helmet security headers, including a content security policy that allows only same-origin scripts, connections, and fonts.
- Password reset and email verification tokens are random, stored hashed, single-use, and expiring. Resetting a password revokes all sessions.
- A suspended account cannot sign in, and all of its existing sessions are deleted.
- Administrator APIs are guarded server-side. Administrators cannot suspend themselves or other administrators from the user screen. Promotion to administrator requires an active, verified customer account and is audited.
- Uploaded images are accepted only when their magic bytes match JPEG, PNG, or WebP. Filenames are randomized. The local uploads directory is not used for identity documents.

### Privacy

- Public reviews show a shortened customer name such as `Maria S.`, never the full name or email.
- A customer's email becomes visible to the provider whose quote was accepted, and only once the request is accepted/in progress/completed, so the two parties can coordinate.
- The assigned provider's sign-in email becomes visible to the customer under the same condition.
- Exact home addresses are not collected. Requests use a catalog location plus a free-text schedule note. Users are asked not to put sensitive address details in public fields.
- No payments, card data, government IDs, or identity-document images are collected.
- Demo records are labeled and must not be presented as real marketplace activity.
- The privacy notice is an MVP template. It intentionally states that no real privacy contact or Data Protection Officer details are published yet.

**Philippine data protection:** the application is designed with data minimization and access control in mind, but it is not certified compliant. Before launch, the operator must review the Data Privacy Act of 2012 (Republic Act No. 10173), its implementing rules, and applicable NPC guidance; publish a working privacy contact and DPO details where required; define lawful bases, retention, deletion, and breach-response procedures; execute data processing agreements with hosting, email, storage, and monitoring providers; and obtain legal advice appropriate to the business. See the in-app Privacy page and [deployment](docs/DEPLOYMENT.md#7-data-privacy-and-launch-checks).

---

## Data model

The Prisma schema is normalized. Identifiers are CUID strings, timestamps are stored as database dates, and statuses are strings constrained by shared Zod contracts so the schema remains portable between SQLite and PostgreSQL.

| Model | Purpose |
| --- | --- |
| `User` | Account, role, status, email verification, demo flag |
| `Session` | Hashed session token and expiry |
| `EmailToken` | One-time email verification token |
| `PasswordResetToken` | One-time password reset token |
| `CustomerProfile` | Customer-specific preferred location |
| `ProviderProfile` | Business identity, approval, verification, cached rating statistics |
| `ServiceListing` | A provider's service, category, price, price type, and inspection flag |
| `Category` | Service category with icon, slug, active flag, ordering |
| `Location` | Hierarchical place: region, province, city, barangay |
| `ProviderServiceArea` | Many-to-many provider coverage |
| `ServiceRequest` | Customer request, location, status, target/assigned provider |
| `Quote` | Provider's price and notes for one request; unique per provider/request |
| `Review` | One per completed request, rating, comment, moderation state, provider response |
| `Favorite` | Customer-saved provider |
| `PortfolioImage` | Provider work image and caption |
| `Report` | Provider or review report with status and resolution |
| `ProviderVerification` | Identity/business request and administrative decision |
| `AuditLog` | Administrative actions with actor, target, and JSON metadata |

Money fields (`startingPrice`, `diagnosticFee`, `proposedPrice`) are integers in centavos. The maximum accepted price is PHP 100,000.

The schema is described in [server/prisma/schema.prisma](server/prisma/schema.prisma), and the full endpoint catalogue is in [docs/API.md](docs/API.md).

---

## Scripts

Run these from the repository root.

| Script | Description |
| --- | --- |
| `npm run dev` | Start the API and Vite dev server together |
| `npm run build` | Build the server and production client |
| `npm start` | Start the built API (which also serves the client if `client/dist` exists) |
| `npm run typecheck` | TypeScript checks for both workspaces |
| `npm test` | Server integration tests, then client unit/component tests |
| `npm run test:e2e` | Playwright tests in desktop and mobile projects |
| `npm run setup` | Install, apply migrations, and seed |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:push` | Push the schema without a migration |
| `npm run db:seed` | Run the idempotent seed |
| `npm run db:reset` | Drop, migrate, and reseed the local database (destructive) |

Workspace-specific commands can be run with `npm run <script> -w server` or `-w client`.

---

## Testing

The project has three layers:

1. **Server integration tests** (`server/tests`) exercise the real Express app and a dedicated SQLite `test.db` through Supertest. They cover CSRF, registration/login/logout, password reset, email verification, provider discovery and filters, request privacy and matching, quote acceptance and transitions, reviews, uploads, admin authorization, approvals, verification badges, moderation, reports, categories, and locations.
2. **Client tests** cover the API client and CSRF retry behavior, currency/date/format helpers, admin helpers, route guards, pagination, and rating components with Vitest, Testing Library, and jsdom.
3. **Playwright E2E tests** cover the public site, authentication and protected redirects, customer, provider, admin, and responsive navigation at 1440×900 and 390×844, checking that key pages have no horizontal overflow.

```bash
# Server + client tests
npm test

# Just one layer
npm run test -w server
npm run test -w client

# Browser tests (the dev servers are started automatically)
npx playwright install chromium
npm run test:e2e
```

E2E tests expect the seeded development database and the demo account credentials documented above. The API and Vite dev server may already be running; Playwright reuses them outside CI. The E2E suite uses the development database, so run `npm run db:reset` afterward if you want the documented demo state back.

Full testing details, isolation rules, and the latest observed command results are in [docs/TESTING.md](docs/TESTING.md). Results are only reported there after the commands have been run.

---

## Deployment

The deployment guide is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). It covers:

- building the client and the single-origin Express setup;
- required production environment values and HTTPS cookies;
- process management and a reverse-proxy example;
- persistence for SQLite and uploads;
- SMTP configuration and the fact that email delivery is not verified here;
- switching from SQLite to PostgreSQL, including migration regeneration;
- backup, monitoring, and launch checks;
- Data Privacy Act launch considerations.

**No deployment has been performed for this repository.** There is no hosted URL, and no claim is made that the application is live. Payments, email, object storage, maps, SMS, and similar external services are not configured.

---

## Verification status

This section records local verification only. It is not evidence of production readiness or deployment.

- The application, seed, API, client, and tests were built and exercised locally on 2026-10-26.
- `npm test` passed **92 tests** (47 server integration, 45 client unit/component).
- `npm run test:e2e` passed **24 Chromium runs** (12 scenarios × desktop/mobile).
- `npm run typecheck` and `npm run build` completed successfully. The client build emitted a chunk-size warning (826 kB minified, 221 kB gzip); see the limitations below.
- The demo database was reseeded and its counts verified directly through Prisma.
- The full command output, timings, and seed counts are recorded in [docs/TESTING.md](docs/TESTING.md#8-latest-local-verification).
- No production database, SMTP provider, object storage, reverse proxy, or hosting platform was configured or tested.
- No payment or external API integration exists.

Use the commands in [docs/TESTING.md](docs/TESTING.md) to reproduce the local checks.

---

## Implemented features

- [x] Responsive public marketplace with honest demo labeling
- [x] Provider directory with keyword, category, price, location, rating, verification filters, sorting, and pagination
- [x] Provider profiles, services and pricing, service areas, portfolio, reviews, favorites, and reports
- [x] Customer/provider registration; administrator accounts created through controlled flows
- [x] Login, logout, HTTP-only sessions, password reset, email verification, and password change
- [x] Server-enforced customer/provider/admin roles and protected client routes
- [x] Service request creation, matching, quote comparison, acceptance and decline
- [x] Full request lifecycle with transactional transitions and ownership checks
- [x] One completed-job review per request, no self-reviews, provider responses
- [x] Provider approval and verification request workflows
- [x] Admin dashboard, provider approvals, verification review, user management, reports, review moderation, categories, locations, and audit log
- [x] Server-side validation and authorization, CSRF, rate limiting, upload validation, CSP in production
- [x] Normalized Prisma schema, integer-centavo money, PostgreSQL-portable types
- [x] Demo seed, `.env.example`, setup and deployment documentation
- [x] Server integration tests, client tests, and desktop/mobile Playwright tests

---

## Known limitations

These are deliberate MVP boundaries or known gaps, not hidden claims of completeness.

**Scope**

- No payments, escrow, invoices, refunds, or dispute resolution. The marketplace stops at connecting customers and providers.
- No in-app chat. Contact details are unlocked only after quote acceptance, and coordination happens outside the platform.
- No calendar booking. “Preferred schedule” is free text, not a confirmed appointment.
- No maps, geocoding, distance calculation, live tracking, SMS, or push notifications.
- No provider availability management, recurring jobs, or crew/team accounts.
- No image editing, CDN, virus scanning, or object storage. Uploads live on local disk and must be placed on persistent storage with backups.
- No email template branding beyond plain text, and no retry queue or delivery webhook.

**Environment and operations**

- SQLite is the only exercised database. PostgreSQL portability was considered in the schema, but the repository ships SQLite migrations only and the PostgreSQL path has not been tested. Regenerate migrations for PostgreSQL before deployment.
- Keyword search uses simple substring matching. There is no full-text index or relevance ranking, and case sensitivity depends on the database. Search behavior should be revisited on PostgreSQL.
- Rate limits are in-memory and per API process. They reset on restart and are not shared across multiple instances. A shared store is required before horizontal scaling.
- Uploaded files and SQLite need a persistent volume and backup plan. No automated backup or restore process is included.
- SMTP delivery is unverified. Without SMTP, no email is sent and development links are printed/returned. In production, email verification and password reset therefore require correctly configured, tested SMTP.
- No distributed tracing, metrics, alerting, or centralized log aggregation. The server emits structured JSON logs and `X-Request-Id`.
- No account deletion/data-export self-service, and no automated retention jobs. A privacy operator process is required before launch.
- The audit log covers administrative actions. Authentication events and ordinary customer/provider lifecycle actions are not written to it.

**Product rules**

- Email verification is recorded and displayed, but it is not currently required to sign in, create requests, or (once approved) quote. Only promotion to administrator requires a verified customer email.
- Only the customer profile screen exposes a password-change form. Providers and administrators can use the password-reset flow; their dashboards do not include a change-password form.
- Administrators cannot suspend or demote other administrators, and the MVP has no explicit administrator-demotion flow.
- Cancelling an accepted request is supported, but the accepted quote and assigned provider remain part of the historical record; there is no refund or reassignment workflow.
- A provider cannot withdraw a quote through the UI/API; a quote can only be edited while the request is open.
- Reviews can be reported and moderated after publication; there is no pre-publication moderation queue. Reviewers cannot edit or delete their reviews.
- Verification relies on an administrator's external checks and a written provider note. The application does not upload, store, or verify identity documents, and an approved badge is not a guarantee of future work quality.
- Provider experience and published prices are self-reported. The interface labels estimates and inspection requirements, but users must still verify details.
- The demo region is Bulacan-focused. New locations can be added by an administrator, but there is no nationwide import tool.
- E2E tests run Chromium only. Firefox and WebKit are not part of the current test matrix.
- The client ships as one JavaScript bundle (about 826 kB minified, 221 kB gzip), and Vite warns that it exceeds 500 kB. Route-level code splitting has not been implemented.
- The in-app legal pages are starting templates with no real DPO/contact details. Legal review and operational privacy processes are required before launch.

---

## Documentation

- [API reference](docs/API.md): authentication, CSRF, endpoint catalogue, payloads, lifecycle, and errors.
- [Deployment guide](docs/DEPLOYMENT.md): single-origin build, HTTPS, database choices, uploads, email, backups, and launch checks.
- [Testing guide](docs/TESTING.md): test layers, isolation, commands, browser setup, and latest local results.
- [Privacy notice](client/src/pages/PrivacyPage.tsx) and [terms](client/src/pages/TermsPage.tsx) as rendered in the app.

---

Built as a full-stack MVP for local service discovery and quote coordination in the Philippines. No deployment, payment integration, or external service configuration is included or claimed.

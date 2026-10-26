# Testing guide

This document describes the automated checks in AyosDito, how they are isolated, how to run them, and what was actually observed locally.

> **Status:** the suites have been executed on a local Windows machine only. There is no CI pipeline, no production deployment, and no claim that these results prove production readiness. See [Latest local verification](#8-latest-local-verification) for the exact commands and counts.

---

## 1. Test layers

| Layer | Tooling | Location | What it exercises |
| --- | --- | --- | --- |
| Server integration | Vitest + Supertest | `server/tests` | The real Express app, middleware, authorization, Prisma, and a dedicated SQLite database |
| Client unit/component | Vitest + jsdom + Testing Library | `client/src/**/*.test.*` | API client behavior, formatting, admin helpers, route guards, pagination, rating display |
| Browser end-to-end | Playwright + Chromium | `e2e` | Public pages, authentication, customer/provider/admin dashboards, responsive navigation |

The server suite is integration-focused: requests go through the same routers, session middleware, CSRF checks, and database used by the running API. It is not a mocked controller test.

---

## 2. Server integration tests

### Suites

- `server/tests/auth.test.ts` — registration, duplicate email, CSRF, HTTP-only session cookies, hashed session storage, login/logout, password reset, email verification, password change.
- `server/tests/providers.test.ts` — public directory visibility, category/location hierarchy filters, keyword and price filters, rating filters requiring at least three reviews, verification filters, pagination, hidden-review handling, provider self-service access.
- `server/tests/requests.test.ts` — request creation and validation, customer/provider privacy, targeted requests, provider matching, quote comparison and acceptance, job transitions, one-review-per-request, declines, cancellation, provider inbox.
- `server/tests/uploads.test.ts` — real image signature checks, disguised-file rejection, avatar replacement cleanup, portfolio creation/removal, the 12-image limit, role enforcement.
- `server/tests/admin.test.ts` — admin authorization, admin promotion eligibility, provider approvals, verification badges, review moderation and rating recalculation, reports, category/location administration, audit records.

Tests share helpers in `server/tests/helpers.ts` that create users, sign in with CSRF, and reset tables between tests.

### Isolation rules

The server suite never touches the development database:

- `server/vitest.config.ts` sets `NODE_ENV=test`, `DATABASE_URL=file:./test.db`, `UPLOAD_DIR=./uploads-test`, `SMTP_HOST=''`, `SEED_DEMO_DATA=false`, and `BCRYPT_ROUNDS=4`.
- `server/tests/global-setup.ts` runs `prisma db push --force-reset --skip-generate` against `server/prisma/test.db`.
- `server/tests/helpers.ts` refuses to run if the database path does not end in `test.db`.
- Test files run sequentially (`fileParallelism: false`) because they share one SQLite file.
- Rate limiting is disabled when `NODE_ENV=test`; the limiter behavior itself is therefore not covered by automated tests.
- Uploaded test files are written under `server/uploads-test` and removed by the tests.

Both `server/prisma/test.db` and `server/uploads-test` are ignored by `.gitignore`. Deleting them is safe; the next test run recreates them.

---

## 3. Client tests

- `client/src/lib/api.test.ts` — request headers, CSRF token handling, retry after a CSRF failure, error-envelope parsing.
- `client/src/lib/format.test.ts` — peso formatting from centavos, dates, relative time, and display helpers.
- `client/src/lib/admin.test.ts` — admin status/role helpers and guard logic.
- `client/src/auth/RequireAuth.test.tsx` — signed-out redirects, intended-path preservation, role checks.
- `client/src/components/ui/Pagination.test.tsx` — visible range and page controls.
- `client/src/components/ui/Stars.test.tsx` — rating rendering and accessible announcement.

The client suite uses `client/src/test/setup.ts` with jsdom and Testing Library. It tests behavior and rendering, not visual regression.

---

## 4. Browser end-to-end tests

`playwright.config.ts` defines two projects:

| Project | Viewport | Device baseline |
| --- | --- | --- |
| `desktop` | 1440×900 | Desktop Chrome |
| `mobile` | 390×844 | Pixel 5 emulation |

There are 12 scenarios, each run in both projects, for 24 runs total:

- **Public** (3): honest demo labeling and product purpose; database-backed provider directory with keyword search; provider profile with seeded reviews and verification state.
- **Authentication** (4): return to the intended page after login; invalid credentials; customer blocked from admin; logout ends the session and protects pages again.
- **Customer** (1): seeded dashboard, request filters, and request-form validation.
- **Provider** (1): approval state, listings, reviews, and verification boundaries.
- **Admin** (1): every moderation area loads and catalog actions require an explicit confirmation dialog.
- **Responsive** (2): public navigation switches to a mobile menu; dashboard navigation switches from a sidebar to a scrollable bar.

### Browser test behavior

- Tests use the seed's default demo credentials: `customer.maria@ayosdito.test` / `Demo1234!`, `provider.laptopcare@ayosdito.test` / `Demo1234!`, and `admin@ayosdito.test` / `Admin123!demo`. These passwords are fixed in `e2e/helpers.ts`; if you change `DEMO_PASSWORD` or `ADMIN_PASSWORD` in `server/.env`, update the helper or the E2E suite will fail to sign in.
- The suite runs sequentially (`workers: 1`, `fullyParallel: false`) against one development database.
- Playwright starts the API and Vite dev server automatically unless `E2E_BASE_URL` is set. Outside CI it reuses servers already listening on ports 4000 and 5173.
- Traces, screenshots, and video are retained only on failure.
- Signing in creates session rows in the development database. The scenarios do not create marketplace records, but run `npm run db:reset` afterward to restore a pristine demo state and clear sessions.
- The suite covers Chromium only. Firefox, WebKit, real devices, and screen readers are not tested.

---

## 5. Commands

```bash
# Install dependencies from the repository root
npm install

# Server integration tests, then client tests
npm test

# One layer at a time
npm run test -w server
npm run test -w client

# Browser tests (first install Chromium)
npx playwright install chromium
npm run test:e2e

# Restore the demo database after browser tests
npm run db:reset
```

Prerequisites:

- Node.js 20.19 or newer (the verification below used Node 24.18.0).
- `server/.env` created from `.env.example`, with `SESSION_SECRET` set.
- For E2E, the demo seed and demo accounts described in the README.

`server/vitest.config.ts` overrides the database, upload, SMTP, and demo-seed values listed above, regardless of the local development environment. Do not change it to point at `dev.db`.

---

## 6. What is not covered

- No CI pipeline, automated browser matrix, load test, penetration test, or accessibility audit was performed.
- No test runs against PostgreSQL; the suite is configured for SQLite.
- Rate limiting is disabled during tests, so its thresholds and keying are not verified by the automated suite.
- SMTP delivery is not tested. Tests only verify the no-SMTP development behavior (a warning is logged and a development link is returned outside production).
- Production static-file serving, HTTPS, reverse proxies, backups, and hosting are not tested.
- No real payment, maps, SMS, AI, or object-storage integration exists to test.
- Client tests do not include screenshot comparison or true mobile-browser testing.
- There is no enforced coverage threshold, and coverage percentages are not reported here.

---

## 7. Troubleshooting

### Playwright reports a missing browser

```bash
npx playwright install chromium
```

### E2E fails because demo data or credentials do not match

Reset the development database, then rerun:

```bash
npm run db:reset
npm run test:e2e
```

`db:reset` is destructive and deletes local development data. Never point it at a database you need to keep.

### Ports 4000 or 5173 are already in use

Playwright reuses an existing server outside CI. Make sure the process on those ports is this project's API/client; otherwise stop it or run the tests against a known instance with `E2E_BASE_URL`.

### Windows reports `EPERM` while running `prisma generate`

A running API process can hold Prisma's query engine DLL. Stop the dev server, then rerun:

```bash
npm run build
```

### Server tests refuse to start

Confirm that `server/vitest.config.ts` still sets `DATABASE_URL=file:./test.db`. The helper intentionally refuses to reset a database that is not named `test.db`.

---

## 8. Latest local verification

Executed on **2026-10-26** on Windows 10 x64 with Node.js **v24.18.0**, Chromium installed through Playwright **1.64.1**.

| Check | Command | Result |
| --- | --- | --- |
| Server integration | `npm run test -w server` | **5 files, 47 tests passed** in 34.07s |
| Client unit/component | `npm run test -w client` | **6 files, 45 tests passed** in 6.62s |
| Combined unit/integration | `npm test` | **92 tests passed**, exit code 0 |
| TypeScript | `npm run typecheck` | Server and client passed with no errors |
| Production build | `npm run build` | Server bundle and client build succeeded |
| Browser E2E | `npm run test:e2e` | **24 passed** (12 scenarios × 2 projects) in 1.3m |
| Demo seed | `npm run db:reset` | Migration applied and seed completed |

Seed counts after reset, verified directly through Prisma:

| Record | Count |
| --- | --- |
| Users | 9 (1 administrator + 8 demo users) |
| Provider profiles | 5 (1 pending approval) |
| Categories | 8 |
| Locations | 12 |
| Service requests | 8 |
| Quotes | 8 |
| Reviews | 4 |
| Service listings | 13 |
| Portfolio images | 0 |

Notes on these results:

- The client production build emitted Vite's chunk-size warning: the main JavaScript bundle was 826.42 kB (220.65 kB gzip). No route-level code splitting is implemented; this is recorded as a known limitation.
- The server build log initially showed a Windows `EPERM` rename warning from `prisma generate` while a dev server held the query engine. After stopping the dev server, `npm run build` completed successfully.
- E2E results are local Chromium results. They do not represent other browsers, real devices, or production infrastructure.
- No deployment, external email delivery, payment flow, PostgreSQL database, or object storage was exercised, because none is configured in this repository.

To reproduce, follow [Commands](#5-commands), then reset the demo database afterward if browser tests were run.

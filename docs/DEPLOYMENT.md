# Deployment guide

This guide describes how the repository is intended to be deployed. **No deployment has been performed for this project.** There is no live URL, no hosting platform, no database server, no SMTP provider, and no object storage configured. Treat every step below as an operational procedure to validate in your own environment, not as evidence that it has already succeeded.

Read the [security and privacy section in the README](../README.md#security-and-privacy) and complete the [launch checks](#7-data-privacy-and-launch-checks) before exposing real user data.

---

## 1. Supported topology

### Recommended: one HTTPS origin

```text
Internet
   │ HTTPS
   ▼
Reverse proxy (TLS) ──> Node/Express (127.0.0.1:4000)
                           ├── /api/*       REST API
                           ├── /uploads/*   public avatar/portfolio images
                           └── /*           built React SPA
```

- Build the client with `npm run build`.
- Run the server from the `server` directory so it loads `server/.env`.
- Express serves `client/dist/index.html` and assets when the build exists, with an SPA fallback that excludes `/api/` and `/uploads/`.
- The browser only talks to one origin, so the `SameSite=Lax` session cookie works normally.
- Configure the reverse proxy to pass `Host` and `X-Forwarded-Proto`.
- The API sets `trust proxy` to `1` in production. This assumes exactly one proxy in front of the app. A longer proxy chain requires code/config review so client IPs and protocol detection remain correct.

### Not supported without code changes

- Hosting the SPA and API on unrelated sites/origins. The session cookie is `SameSite=Lax`; a cross-site frontend would not send it on XHR/fetch requests. The code does not expose a `SameSite=None` option.
- Running multiple API processes against one SQLite file or relying on the in-memory rate limiter across instances.
- Serving uploaded files from an executable or untrusted directory.
- Identity-document storage. The application intentionally has no such upload feature and should not be extended by putting documents in `/uploads`.

### Requirements

- Node.js **20.19+**.
- A domain name and TLS certificate.
- A persistent directory for uploaded images.
- A database. SQLite is the only database used and tested in this repository. PostgreSQL is a documented migration path, not a tested deployment.
- A process supervisor (systemd, another well-understood supervisor, or a platform that restarts crashed processes).
- SMTP if users need to verify email or reset passwords without an administrator manually generating links.

No Dockerfile, container manifest, infrastructure-as-code, or CI/CD pipeline is included.

---

## 2. Build and run locally in production mode

These steps assume a Linux host at `/srv/ayosdito` and a reverse proxy on the same machine. Adapt paths for your environment.

### 2.1 Install dependencies and build

```bash
cd /srv/ayosdito
npm ci
npm run build
```

`npm run build`:

1. runs `prisma generate` and builds the API with `tsup` to `server/dist`;
2. runs TypeScript checks and builds the client to `client/dist`.

Confirm both exist:

```bash
test -f server/dist/index.js
test -f client/dist/index.html
```

If `client/dist/index.html` is missing, Express will only serve an API-running message at `/`; the SPA will not be available.

### 2.2 Create the production environment file

Create `server/.env` on the server (not in source control):

```dotenv
NODE_ENV=production
PORT=4000

# Use an absolute path when practical; SQLite paths in Prisma are relative to
# the schema directory unless absolute.
DATABASE_URL="file:/var/lib/ayosdito/ayosdito.db"

APP_BASE_URL=https://ayos.example.com
CORS_ORIGINS=https://ayos.example.com

SESSION_SECRET=replace-with-a-long-random-secret-generated-for-this-deployment
BCRYPT_ROUNDS=12
SESSION_TTL_DAYS=7
COOKIE_SECURE=true

UPLOAD_DIR=/var/lib/ayosdito/uploads
MAX_UPLOAD_MB=5

ADMIN_EMAIL=admin@ayos.example.com
ADMIN_PASSWORD=use-a-unique-strong-password
ADMIN_NAME=AyosDito Admin

SEED_DEMO_DATA=false

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=…
SMTP_PASS=…
MAIL_FROM="AyosDito <no-reply@example.com>"
```

Generate `SESSION_SECRET` yourself, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Protect the file:

```bash
chmod 600 server/.env
```

Production behavior enforced by the server:

- `SESSION_SECRET` must be at least 32 characters and must not include `replace`.
- `CORS_ORIGINS` must not contain `*`.
- Cookies are forced `Secure` in production, so HTTPS is required for login.
- `clientDist` defaults to `../client/dist` relative to the server working directory.
- `UPLOAD_DIR` is resolved from the server working directory. Use an absolute path or verify the resolved directory.
- The demo seed is skipped in production even if `SEED_DEMO_DATA=true`.

If `ADMIN_PASSWORD` is missing while seeding production, the seed exits with a clear error. The seed never prints the administrator password in production.

Rotating `SESSION_SECRET` invalidates all existing sessions and all outstanding hashed email/reset tokens. Plan rotation as a global sign-out.

### 2.3 Prepare directories

SQLite and uploads must survive deployments:

```bash
sudo mkdir -p /var/lib/ayosdito/uploads
sudo chown -R ayosdito:ayosdito /var/lib/ayosdito
```

Use a dedicated unprivileged service account. Do not run the API as root. Make sure that account can write the SQLite database and its directory, plus the uploads directory, and can read the application files and `server/.env`.

### 2.4 Apply migrations and seed

Run from the repository root or the server workspace with the production environment loaded:

```bash
cd /srv/ayosdito
npm run db:deploy -w server
npm run db:seed -w server
```

`prisma migrate deploy` applies committed migrations. Use it in production; do not use `prisma db push` against production data.

The production seed:

- creates the administrator if that email does not already exist;
- creates/updates the category and location catalog;
- skips all demo accounts and sample marketplace content in production.

If an administrator with `ADMIN_EMAIL` already exists, the seed leaves the password and role unchanged. Set the intended password before the first seed, or use the password-reset flow later. Do not assume editing `ADMIN_PASSWORD` updates an existing account.

### 2.5 Start the API

The safest way to control paths and dotenv loading is to start from the `server` directory:

```bash
cd /srv/ayosdito/server
NODE_ENV=production node dist/index.js
```

Do not start `node dist/index.js` from an unrelated working directory: `.env`, uploads, and the client build are resolved relative to the server working directory.

For a process supervisor, a minimal systemd unit looks like this (adjust user, paths, and Node path):

```ini
[Unit]
Description=AyosDito API and web
After=network.target

[Service]
Type=simple
User=ayosdito
WorkingDirectory=/srv/ayosdito/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
# Environment values can be supplied by server/.env, which dotenv loads.
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ayosdito
sudo systemctl status ayosdito
curl -s http://127.0.0.1:4000/api/health
```

The health endpoint verifies database connectivity with a simple query and returns uptime and server time.

### 2.6 Reverse proxy and HTTPS

Example Nginx location block:

```nginx
server {
    listen 443 ssl http2;
    server_name ayos.example.com;

    ssl_certificate     /etc/letsencrypt/live/ayos.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ayos.example.com/privkey.pem;

    client_max_body_size 6m;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name ayos.example.com;
    return 301 https://$host$request_uri;
}
```

Notes:

- Keep `client_max_body_size` slightly above the app upload limit so users get the app's validation message rather than a proxy error.
- `APP_BASE_URL` and `CORS_ORIGINS` must match the public HTTPS origin. A mismatch affects links and origin checks.
- Only expose ports 80/443 publicly. Bind the API to localhost or a private network.
- The app sets security headers in production. The proxy can add HSTS and other transport controls; make sure you understand the effect before enabling preloading.

### 2.7 Smoke test

Using HTTPS:

1. Open the home page.
2. Confirm `/api/health` returns `status: "ok"`.
3. Sign in as the administrator.
4. Confirm provider applications, categories, locations, and audit pages load.
5. Register a fresh customer account.
6. If SMTP is configured, confirm the verification email arrives and the link works.
7. Test password reset for a non-administrator test account.
8. Confirm uploaded portfolio images appear and remain after a restart.
9. Confirm a non-admin account receives `403` on an `/api/admin/*` request.

Do not seed demo data or use demo credentials in production.

---

## 3. Database

### SQLite (included and tested)

The repository uses `provider = "sqlite"` and ships a SQLite migration. For a single-instance, low-write deployment it can be workable, but it is not a high-availability database.

- Keep `dev.db`/the production database **outside** the public web root.
- Back up the database file and uploads together; a database backup alone is incomplete if it references uploaded files.
- Use a single API process. SQLite has limited write concurrency and the app's in-memory limits do not coordinate between processes.
- Test restore procedures. Copying a live SQLite file without a proper backup mechanism can produce an inconsistent backup; use SQLite's backup facilities or stop writes during a file-level snapshot.
- Never commit database files; `.gitignore` already excludes them.

The committed directory is `server/prisma/migrations/20261025172353_init`. Migration SQL is SQLite-specific.

### PostgreSQL (documented path, not tested here)

The Prisma schema uses portable scalar types and string status columns, so PostgreSQL is a reasonable production target. However, **the repository has not been run against PostgreSQL**, and the included test suite is wired to SQLite. Validate the full application and test harness on a real PostgreSQL instance before relying on it.

Outline of the change:

1. Back up existing data and confirm you can restore it.
2. Provision PostgreSQL and create a dedicated database/user with least privilege. Require TLS if the database is remote.
3. Change the Prisma datasource:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

4. The existing migrations contain SQLite SQL and must not be applied to PostgreSQL. On a branch/copy, archive or remove `server/prisma/migrations`, point `DATABASE_URL` at a fresh PostgreSQL database, and generate a new initial migration:

   ```bash
   cd server
   npx prisma migrate dev --name init_postgres
   ```

   Commit the PostgreSQL migration set. If you need to keep SQLite for local development, use a separate schema/migrations strategy rather than mixing migration histories in one branch.

5. Set a PostgreSQL connection string:

   ```dotenv
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/ayosdito?schema=public&sslmode=require"
   ```

   Use your provider's required SSL mode. URL-encode special characters in the password.

6. Generate the client and deploy migrations:

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

7. Run the application test suite against PostgreSQL. This is not a one-line switch:
   - `server/vitest.config.ts` hardcodes `DATABASE_URL=file:./test.db`;
   - `server/tests/global-setup.ts` uses `prisma db push --force-reset` for SQLite;
   - `server/tests/helpers.ts` refuses to run unless `DATABASE_URL` contains `test.db`.

   You must adapt those safeguards to a dedicated PostgreSQL test database and keep them isolated from production. Do not remove the safeguards and point tests at production.

8. Review search behavior. The directory uses Prisma `contains` without case-insensitive mode. SQLite's default `LIKE` behavior differs from PostgreSQL's case-sensitive `LIKE`. Decide whether to normalize search terms, add `mode: "insensitive"`, or use PostgreSQL full-text search/indexes. Re-test ranking, filters, and pagination.

9. Check indexes and query plans under realistic data volumes. The schema has indexes for the main filters, but no PostgreSQL-specific tuning has been done.

10. Update backups, monitoring, connection pooling, and migrations for the database service. `prisma migrate deploy` should run as a release step, not from every app instance at boot without coordination.

### Demo data in production

`server/prisma/seed.ts` computes `demoEnabled = config.seedDemoData && !config.isProduction`. Production seeding therefore creates only the administrator and catalog. Set `SEED_DEMO_DATA=false` as defense in depth. Do not copy a development SQLite database containing demo records into production.

---

## 4. Uploads

The app stores avatars and portfolio images (JPEG/PNG/WebP, max 5 MB by default) on local disk:

- Set `UPLOAD_DIR` to a persistent path outside the repository working copy if possible.
- Back up uploaded files and the database on compatible schedules.
- Keep the directory writable only by the service account.
- The API serves files under `/uploads/` with `X-Content-Type-Options: nosniff`, `Content-Disposition: inline`, `dotfiles: deny`, an index listing disabled, and a one-day cache header.
- The app rejects invalid file signatures, randomizes filenames, and deletes replaced avatars/removed portfolio files it manages.
- There is no virus scanning, image re-encoding, EXIF stripping, CDN, or object storage integration. Public upload endpoints are limited to authenticated providers, but you should add malware scanning and image processing appropriate to your risk model before broad public use.
- Never use this directory for identity documents, private customer files, database backups, or secrets.

If you later move uploads to object storage, keep authorization semantics in mind: portfolio images are public, while the application intentionally does not accept sensitive documents.

---

## 5. Email

Email is optional for the app to start, but it is effectively **required** for production account recovery and email verification. Without SMTP, `sendMail` logs a warning and returns `false`; no message is sent.

- Development (and any non-production environment): verification and reset URLs are logged and returned to the client for testing.
- Production: development URLs are not returned or logged. If SMTP is absent or failing, users will not receive verification or reset links.
- `sendMail` does not fail the HTTP request when delivery fails; it logs an error. There is no retry queue, bounce handling, or delivery webhook. Administrators must monitor logs.
- Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM`.
- Use a sending domain with SPF, DKIM, and DMARC aligned. Use a monitored reply path.
- Test registration verification and password reset end to end with a real inbox before launch.
- Do not use the demo accounts or placeholder `MAIL_FROM` in production.
- The application sends plain-text email only.

No email provider has been configured or tested for this repository.

---

## 6. Security operations

### Required

- Serve HTTPS only. `COOKIE_SECURE` is forced on in production.
- Use a unique, random `SESSION_SECRET` per environment; never reuse the development placeholder.
- Keep `server/.env` at restrictive permissions and out of source control.
- Run the service as an unprivileged user with the smallest necessary filesystem permissions.
- Restrict database and SMTP credentials to the application.
- Set `CORS_ORIGINS` to the exact production origin; do not use `*` (the server rejects it in production).
- Protect the admin account with a strong unique password. The seeded admin is not automatically verified by a real external identity check; it is simply the application administrator.
- Keep `SEED_DEMO_DATA=false` and do not run demo seed data in production.
- Back up the database and uploads, and test restoring both.
- Monitor `/api/health`, error logs, disk space, database backups, and email delivery failures.
- Keep Node dependencies patched. Re-run `npm audit`, `npm run typecheck`, `npm test`, and `npm run test:e2e` after dependency or schema changes. Audit output must be reviewed; passing tests do not prove the absence of vulnerabilities.
- Review the reverse proxy so that `X-Forwarded-Proto` and `X-Forwarded-For` cannot be spoofed by clients. The app sets `trust proxy` to 1; adapt if your chain differs.
- Rotate credentials after incidents and after staff changes.

### Important limitations

- Rate limiting is in-memory. It resets when the API restarts and is not shared between processes. For multi-instance or more robust limiting, add a shared store and review the trust-proxy configuration.
- The audit log covers administrator actions only. It is not a complete security event log. Add centralized authentication/security monitoring separately.
- The application has no Web Application Firewall or bot-management layer.
- No CSRF bypass is intended; never disable CSRF or origin checks as a shortcut for API clients. API clients must perform the CSRF handshake.
- The application does not handle payments. Do not add payment credentials or card data to request/quote fields.
- The public legal pages are templates. Complete them with the real operator identity and contact channels.

---

## 7. Data privacy and launch checks

The application is not certified compliant with the Philippine Data Privacy Act of 2012 (RA 10173) merely because it minimizes data or has access controls. Before launching with real users:

- Identify the personal data controller and publish the legal entity, address, monitored privacy contact, and Data Protection Officer details where required.
- Conduct a privacy impact assessment for the actual data flows: accounts, requests, locations, provider verification notes, uploaded portfolio images, reports, logs, and backups.
- Define lawful bases, purpose limitation, consent where required, and clear notices at collection points.
- Decide and implement retention schedules for accounts, requests, reviews, reports, audit logs, uploaded images, session data, and backups. The MVP has no automated retention job.
- Implement an operational process for data-subject rights (access, correction, erasure/blocking, objection, complaint handling), including identity verification and response timelines. The MVP has no self-service deletion or data export.
- Minimize location data. Do not add exact home addresses to public fields or ask providers to upload identity documents without designing secure private storage, access control, retention, and processor agreements.
- Sign data processing agreements with hosting, database, storage, email, and monitoring providers; record cross-border transfers and safeguards.
- Define a breach-response plan, incident roles, containment steps, notification assessment, and a log of decisions. The app's structured logs and audit log can support investigation but are not an incident-response system.
- Evaluate NPC registration and notification obligations applicable to your organization and processing.
- Obtain legal and data-protection advice for the actual operating entity before launch. The in-app privacy and terms pages are starting points written for this MVP, not legal advice.

The app's privacy design choices include shortened public reviewer names, email unlock only after quote acceptance, no exact-address field, no payment data, no identity-document uploads, and no external analytics SDK. These choices do not replace the operational and legal work above.

---

## 8. Backups and recovery

Back up:

1. the database (SQLite file or PostgreSQL dump);
2. the upload directory;
3. `server/.env` or the environment secret set, stored securely and separately from the backups;
4. deployment configuration and migration history.

For each release:

- test that the backup can be restored into a staging environment;
- verify referenced images still exist after restore;
- verify users can sign in, uploads render, and admin actions work;
- keep a rollback plan for both application code and schema changes.

No automated backup or restore tooling is included. Do not claim a backup works until a restore has been tested.

---

## 9. Release checklist

- [ ] Production environment values reviewed; no placeholder secrets
- [ ] `NODE_ENV=production`, `SEED_DEMO_DATA=false`
- [ ] HTTPS configured; `APP_BASE_URL` and `CORS_ORIGINS` match the public origin
- [ ] `SESSION_SECRET` generated for this deployment and stored securely
- [ ] Admin password is unique and strong; no demo accounts exist
- [ ] Database migrated with `prisma migrate deploy`; backup taken first
- [ ] Test suite run against the chosen database stack (PostgreSQL requires harness changes)
- [ ] Uploads directory is persistent, writable by the app, and excluded from public source trees
- [ ] SMTP configured and tested end to end, or the lack of email explicitly accepted and supported operationally
- [ ] Reverse proxy passes forwarded headers; only the proxy is publicly reachable
- [ ] Rate-limit and trust-proxy assumptions match the deployment topology
- [ ] Logs, health checks, disk alerts, and backups monitored
- [ ] Privacy notice, terms, DPO/contact, retention, and data-subject request process completed
- [ ] Security review and dependency audit completed
- [ ] Manual smoke test completed on the deployed domain
- [ ] Rollback plan tested
- [ ] No unverified claim of “live”, “secure”, “compliant”, or “email configured” is made before it is true

---

## 10. What is not included

To avoid ambiguity:

- no live deployment or public URL;
- no Dockerfile or container images;
- no CI/CD pipeline;
- no managed database provisioning;
- no object storage/CDN;
- no SMTP account or verified sender domain;
- no payment gateway;
- no SMS, push, maps, geocoding, analytics, or AI integration;
- no PostgreSQL migrations or production PostgreSQL test run;
- no backup automation, monitoring service, WAF, or DDoS protection;
- no legal review or regulatory certification.

After completing real deployment and verification, update the README and this guide with the actual URL, host, database, monitoring, and tested date. Until then, the project remains a locally developed MVP.

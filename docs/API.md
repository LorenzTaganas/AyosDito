# AyosDito API reference

**API version:** MVP, repository version `0.1.0`

This document describes the REST API implemented by `server/src`. It reflects the code in this repository, not a hosted service. The project is **not deployed**, and no external email, payment, maps, or storage provider is configured.

- Development base URL: `http://localhost:4000/api`
- Vite proxies `/api` and `/uploads` from `http://localhost:5173` to the API.
- In the recommended production setup, the client and API share one HTTPS origin and the client calls `/api`.
- Machine-readable DTO types live in [`shared/api-types.ts`](../shared/api-types.ts); validation rules live in [`shared/contracts.ts`](../shared/contracts.ts).

There is no OpenAPI/Swagger document or generated SDK.

---

## 1. Conventions

### Response envelopes

Successful JSON responses use:

```json
{
  "data": { }
}
```

Paginated lists add `meta`:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Provider search can also include `meta.includesDemoData`, which is `true` when the current page contains at least one demo provider.

Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields.",
    "details": {
      "formErrors": [],
      "fieldErrors": {
        "email": ["Enter a valid email address."]
      }
    },
    "requestId": "7e2f..."
  }
}
```

Validation errors use HTTP `422`, with Zod's flattened error under `details` (`formErrors` and `fieldErrors`). The client maps `details.fieldErrors` to form fields.

Headers:

| Header | Direction | Notes |
| --- | --- | --- |
| `Content-Type: application/json` | request | Required for JSON bodies. |
| `X-CSRF-Token` | request | Required on `POST`, `PUT`, `PATCH`, and `DELETE`. Must equal the `ayos_csrf` cookie. |
| `X-Request-Id` | response | Also included in API error bodies. |
| `Set-Cookie` | response | `ayos_session` is HTTP-only; `ayos_csrf` is readable by the client. |

### Data conventions

- IDs are opaque CUID strings. Do not parse or assume their length.
- Timestamps are ISO 8601 strings in UTC.
- **Money is an integer number of centavos.** Example: `95000` = PHP 950.00.
- Prices must be between `0` and `10,000,000` centavos (PHP 100,000). A quote price must be greater than zero.
- Pagination defaults vary: provider search defaults to `pageSize=12` with a maximum of `24`; other paginated endpoints default to `20` with a maximum of `50`.
- Passwords are 8–72 characters and must contain at least one letter and one number.
- Request titles are 5–100 characters; problem descriptions are 20–2,000 characters.
- Public provider reviews show shortened author names; the full customer name/email is not part of public review DTOs.

### Authentication

The API uses cookie sessions, not bearer tokens.

1. `POST /api/auth/login` (or registration) sets the `ayos_session` cookie.
2. Send cookies with every authenticated request (`credentials: "include"` in `fetch`).
3. For unsafe methods, read the `ayos_csrf` cookie and echo it in `X-CSRF-Token`.
4. `POST /api/auth/logout` deletes the session and clears the cookie.

The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. The supported deployment is a single HTTPS origin. Cross-site frontend hosting is not part of the supported configuration.

### CSRF example with curl

Development-only example:

```bash
BASE=http://localhost:4000
JAR=/tmp/ayos-cookies.txt

curl -s -c "$JAR" "$BASE/api/auth/csrf" > /dev/null
CSRF=$(awk '$6 == "ayos_csrf" { print $7 }' "$JAR")

curl -s -b "$JAR" -c "$JAR" \
  -H 'Content-Type: application/json' \
  -H "X-CSRF-Token: $CSRF" \
  -d '{"email":"customer.maria@ayosdito.test","password":"Demo1234!"}' \
  "$BASE/api/auth/login"
```

The demo password is controlled by `DEMO_PASSWORD` and is not intended for production. Never put real credentials in shell history or source control.

### Roles and statuses

Roles: `CUSTOMER`, `PROVIDER`, `ADMIN`.

Account status: `ACTIVE`, `SUSPENDED`.

Provider approval: `PENDING`, `APPROVED`, `REJECTED`.

Verification: `UNVERIFIED`, `IDENTITY_VERIFIED`, `BUSINESS_VERIFIED`.

Request status: `PENDING`, `RESPONDED`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `DECLINED`.

Quote status: `PENDING`, `ACCEPTED`, `DECLINED`.

Report status: `OPEN`, `RESOLVED`, `DISMISSED`.

Review visibility: `VISIBLE`, `HIDDEN`.

The server checks the authenticated role and record ownership/scope for every protected route. Client-side role guards are not a security boundary.

---

## 2. Endpoint index

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | Public | Database connectivity, uptime, server time |

### Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/auth/csrf` | Public | Ensure/read the CSRF cookie; returns `{ data: { token } }` |
| POST | `/auth/register` | Public | Register a customer or provider; starts a session |
| POST | `/auth/login` | Public | Sign in; sets the session cookie |
| POST | `/auth/logout` | Public | Delete the current session; `204` |
| GET | `/auth/me` | Public | Current user or `null` |
| POST | `/auth/forgot-password` | Public | Generate a reset token; generic response |
| POST | `/auth/reset-password` | Public | Consume a reset token; revokes all sessions |
| POST | `/auth/verify-email` | Public | Consume an email verification token |
| POST | `/auth/resend-verification` | Signed in | Replace the pending email token |
| POST | `/auth/change-password` | Signed in | Verify current password; revoke other sessions |

### Catalog and public providers

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/categories` | Public | Active categories with public provider counts |
| GET | `/categories/:slug` | Public | One active category |
| GET | `/locations` | Public | Active locations as references with parent names |
| GET | `/locations/:id/children` | Public | Active direct children of a location |
| GET | `/providers` | Public | Search approved providers with filters and pagination |
| GET | `/providers/:id` | Public | Provider detail, services, portfolio, recent reviews |
| GET | `/providers/:id/reviews` | Public | Paginated visible reviews |

### Customer

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/customer/dashboard` | Customer | Request counts, quotes to review, favorites, recent requests |
| PATCH | `/customer/me` | Customer | Update full name and preferred location |
| GET | `/favorites` | Customer | Paginated saved providers |
| POST | `/favorites/:providerId` | Customer | Save an approved provider |
| DELETE | `/favorites/:providerId` | Customer | Remove a saved provider; `204` |
| POST | `/requests` | Customer | Create a service request |
| GET | `/requests/me` | Customer | Own requests, optional `status` filter |
| GET | `/requests/:id` | Authenticated | Owner, allowed provider, or admin |
| GET | `/requests/:id/quotes` | Authenticated | Quotes visible to the viewer |
| PATCH | `/requests/:id/cancel` | Customer | Cancel an open/accepted request |
| POST | `/requests/:id/review` | Customer | Review a completed request once |
| PATCH | `/quotes/:id` | Provider | Edit an open quote |
| POST | `/quotes/:id/accept` | Customer | Accept one quote and decline the others |
| POST | `/quotes/:id/decline` | Customer | Decline one quote |
| POST | `/reports` | Signed in | Report a provider or review |
| POST | `/reviews/:id/report` | Signed in | Report a review |

### Provider self-service

All paths below are prefixed with `/providers` and require the `PROVIDER` role.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/me` | Full own provider profile including approval and verification requests |
| PATCH | `/me` | Update business name, description, years of experience |
| GET | `/me/dashboard` | Approval/verification summary, counts, opportunities, reviews |
| POST | `/me/services` | Create a service listing |
| PATCH | `/me/services/:serviceId` | Update a listing |
| DELETE | `/me/services/:serviceId` | Delete a listing; `204` |
| PUT | `/me/service-areas` | Replace the complete service-area selection |
| POST | `/me/avatar` | Upload/replace avatar (`multipart/form-data`, field `avatar`) |
| POST | `/me/portfolio` | Upload a portfolio image (`multipart/form-data`, field `image`) |
| DELETE | `/me/portfolio/:imageId` | Remove a portfolio image and its file |
| GET | `/me/requests` | Opportunities, quotes, or assigned jobs |
| GET | `/me/reviews` | Paginated visible reviews |
| PATCH | `/me/reviews/:reviewId/response` | Create/update the provider's public response |
| POST | `/me/verifications` | Submit an identity or business verification request |

### Administrator

All paths below require the `ADMIN` role and are prefixed with `/admin`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/dashboard` | Platform counts, pending providers, open reports, recent audit entries |
| GET | `/users` | Paginated user search and filters |
| PATCH | `/users/:id/status` | Suspend or reactivate a non-admin account |
| POST | `/users/:id/grant-admin` | Promote an eligible customer to administrator |
| GET | `/providers` | Paginated provider applications |
| PATCH | `/providers/:id/approval` | Approve or reject a provider |
| GET | `/verifications` | Paginated verification requests |
| PATCH | `/verifications/:id` | Approve or reject a verification request |
| GET | `/categories` | All categories with counts |
| POST | `/categories` | Create a category |
| PATCH | `/categories/:id` | Update a category |
| GET | `/locations` | All locations with counts |
| POST | `/locations` | Create a location |
| PATCH | `/locations/:id` | Update a location; deactivation cascades to descendants |
| GET | `/reviews` | Paginated review moderation list |
| PATCH | `/reviews/:id/moderation` | Show/hide a review; recalculates provider stats |
| GET | `/reports` | Paginated report queue |
| PATCH | `/reports/:id` | Resolve or dismiss an open report |
| GET | `/audit-logs` | Paginated administrative audit log |

---

## 3. Authentication endpoints

### POST `/api/auth/register`

Body:

```json
{
  "fullName": "Maria Santos",
  "email": "maria@example.com",
  "password": "Example123",
  "role": "CUSTOMER"
}
```

For `role: "PROVIDER"`, `businessName` is required (2–80 characters). Public registration accepts only `CUSTOMER` or `PROVIDER`; `ADMIN` is rejected by validation.

Response `201`:

```json
{
  "data": {
    "user": { "id": "…", "fullName": "Maria Santos", "email": "maria@example.com", "role": "CUSTOMER", "emailVerified": false, "…": "…" },
    "devVerificationUrl": "http://localhost:5173/verify-email?token=…"
  }
}
```

- Registration signs the user in and sets the session cookie.
- The email verification token is hashed at rest and expires after 24 hours.
- `devVerificationUrl` is returned only when the API is not running in production. In production the URL is neither returned nor logged. Without SMTP, no email is sent.

### POST `/api/auth/login`

```json
{ "email": "customer.maria@ayosdito.test", "password": "Demo1234!" }
```

Returns `{ "data": { "user": { … } } }` and sets the session cookie. Wrong emails and wrong passwords return the same generic `401` message. Suspended accounts receive `403 ACCOUNT_SUSPENDED`. Sessions expire after `SESSION_TTL_DAYS` (default 7).

### POST `/api/auth/logout`

Returns `204` and invalidates the current session. Other sessions for the same account are not necessarily removed.

### GET `/api/auth/me`

```json
{ "data": { "user": null } }
```

or the authenticated `AuthUser` object.

### POST `/api/auth/forgot-password`

```json
{ "email": "user@example.com" }
```

Always responds with a generic message for valid input, whether or not the account exists. When the account is active, a reset token is created (valid 30 minutes) and `devResetUrl` is included outside production. The response is intentionally not an email-existence oracle.

### POST `/api/auth/reset-password`

```json
{ "token": "…", "password": "NewPassword123" }
```

Validates and consumes the single-use token, updates the password hash, deletes all sessions for the account, consumes other outstanding reset tokens, and clears the session cookie. Token reuse or expiry returns `400 INVALID_RESET_TOKEN`.

### POST `/api/auth/verify-email`

```json
{ "token": "…" }
```

Consumes a single-use verification token (24-hour lifetime). Already-used or expired tokens return `400 INVALID_VERIFICATION_TOKEN`.

### POST `/api/auth/resend-verification`

Authenticated. Returns `409 ALREADY_VERIFIED` if the email is already verified. Otherwise it consumes/replaces outstanding verification tokens and returns a new development URL outside production if SMTP is not used.

### POST `/api/auth/change-password`

Authenticated.

```json
{ "currentPassword": "OldPassword123", "newPassword": "NewPassword123" }
```

Rejects an incorrect current password with `400 INVALID_PASSWORD`; rejects the same password as the new one by validation; deletes other sessions after success. The current session remains valid.

---

## 4. Catalog

### GET `/api/categories`

Returns active categories, ordered by `sortOrder` then name:

```json
{
  "data": [
    {
      "id": "…",
      "name": "Laptop & Computer Repair",
      "slug": "laptop-computer-repair",
      "description": "Diagnostics, repairs, upgrades…",
      "icon": "laptop",
      "isActive": true,
      "sortOrder": 10,
      "providerCount": 1
    }
  ]
}
```

`providerCount` counts approved, active providers with an active listing in that category.

### GET `/api/categories/:slug`

One active category in the same shape. Inactive or unknown categories return `404`.

### GET `/api/locations`

Returns active locations as:

```json
{ "id": "…", "name": "City of Malolos", "locationType": "CITY", "parentName": "Bulacan" }
```

Locations are sorted by type (`REGION`, `PROVINCE`, `CITY`, `BARANGAY`) and then name. This is a flat list, not a nested tree.

### GET `/api/locations/:id/children`

Returns active direct children in the same reference shape. An unknown parent returns `404`; an unknown child list is an empty array only when the parent exists.

---

## 5. Provider search and public profiles

### GET `/api/providers`

Query parameters:

| Parameter | Type | Notes |
| --- | --- | --- |
| `q` | string, max 100 | Substring match on business name, description, active listing title, and active listing description |
| `category` | string (slug) | Active category slug |
| `locationId` | string | Active location; expands to ancestors and descendants |
| `minPrice` / `maxPrice` | integer centavos | Filters the provider's lowest active service price |
| `minRating` | integer 1–5 | Only providers with at least 3 visible reviews at/above the rating |
| `verified` | `any`, `identity`, `business` | Filters recorded administrative verification |
| `sort` | `recommended`, `rating`, `price_asc`, `price_desc`, `newest` | Defaults to `recommended` |
| `page` | integer ≥1 | Defaults to 1 |
| `pageSize` | integer 1–24 | Defaults to 12 |

Notes:

- Only approved, active providers with at least one active listing in an active category and at least one active service area are returned.
- `minRating` and `sort=rating` restrict results to providers with at least three visible reviews, so unproven ratings do not dominate a rating sort.
- Price filters apply to `minStartingPrice` (the lowest active listing), not to every service.
- `recommended` uses a Bayesian rating score, then review count, verification rank, and account age; it is not a paid ranking.
- Invalid filters return `422 INVALID_QUERY`; unknown category slugs or locations return `400`.

Response:

```json
{
  "data": [
    {
      "id": "…",
      "businessName": "Malolos Laptop Care",
      "description": "Home-service laptop and desktop repair…",
      "profileImage": null,
      "yearsOfExperience": 6,
      "verificationStatus": "UNVERIFIED",
      "identityVerified": false,
      "businessVerified": false,
      "ratingAvg": 4.7,
      "reviewCount": 3,
      "minStartingPrice": 35000,
      "isDemo": true,
      "categories": [{ "id": "…", "name": "Laptop & Computer Repair", "slug": "laptop-computer-repair", "icon": "laptop" }],
      "serviceAreas": [{ "id": "…", "name": "City of Malolos", "locationType": "CITY", "parentName": "Bulacan" }],
      "createdAt": "2026-…"
    }
  ],
  "meta": { "page": 1, "pageSize": 12, "total": 4, "totalPages": 1, "includesDemoData": true }
}
```

### GET `/api/providers/:id`

Returns `ProviderDetail`:

- everything in the public summary, plus
- `listings`: active listings (all listing DTO fields),
- `portfolioImages`: public image URLs and captions,
- `recentReviews`: up to 3 visible reviews,
- `completedJobs`: count of requests assigned to the provider with status `COMPLETED`,
- `memberSince`,
- `isFavorite`: relevant to a signed-in customer.

Only active categories/listings and active service areas are returned. Unknown, unapproved, suspended, or otherwise hidden providers return `404`. The public profile does not expose the provider's user email.

### GET `/api/providers/:id/reviews`

Visible reviews only, newest first. `page` defaults to 1; `pageSize` defaults to 20 and is capped at 50.

Review DTO:

```json
{
  "id": "…",
  "rating": 5,
  "comment": "…",
  "createdAt": "2026-…",
  "customerDisplayName": "Maria S.",
  "providerResponse": "Thank you…",
  "providerRespondedAt": "2026-…"
}
```

`customerDisplayName` is shortened by the API. A hidden review does not appear and does not affect rating aggregates.

---

## 6. Requests and quotes

### Request DTO and permissions

Request details include permission flags computed for the viewer:

```json
{
  "id": "…",
  "title": "Laptop sobrang bagal at nagha-hang",
  "problemDescription": "…",
  "status": "RESPONDED",
  "preferredSchedule": "Weekend mornings",
  "createdAt": "…",
  "updatedAt": "…",
  "completedAt": null,
  "cancelledAt": null,
  "category": { "id": "…", "name": "Laptop & Computer Repair", "slug": "laptop-computer-repair", "icon": "laptop" },
  "location": { "id": "…", "name": "Guinhawa", "locationType": "BARANGAY", "parentName": "City of Malolos" },
  "customer": { "displayName": "Maria Santos", "contactEmail": null },
  "targetProvider": null,
  "assignedProvider": null,
  "quotes": [],
  "review": null,
  "permissions": {
    "canCancel": true,
    "canAcceptQuotes": true,
    "canDeclineQuotes": true,
    "canStartJob": false,
    "canCompleteJob": false,
    "canQuote": false,
    "canReview": false,
    "hasQuoted": false
  }
}
```

Privacy behavior:

- The customer always sees their own full name and email.
- A provider sees only a shortened customer name until the request is in `ACCEPTED`, `IN_PROGRESS`, or `COMPLETED`, at which point the assigned provider sees the customer's email.
- The customer sees the assigned provider's sign-in email only after acceptance.
- Providers see only their own quote in a request's quote list. Customers see all quotes. A provider's request summary reports `quoteCount: 1` when it has quoted, otherwise `0`, and includes `myQuoteStatus`.

### POST `/api/requests` (customer)

```json
{
  "categoryId": "…",
  "title": "Laptop sobrang bagal at nagha-hang",
  "problemDescription": "My laptop freezes when I open several applications…",
  "locationId": "…",
  "preferredSchedule": "Weekend mornings",
  "targetProviderId": "optional-provider-id"
}
```

All fields except `preferredSchedule` and `targetProviderId` are required. Category and location must be active. A target provider must be approved, active, list the selected category, and cover the selected location.

Response `201` with `ServiceRequestDetail`. New requests start `PENDING`. The request owner is the signed-in customer; the client cannot choose another customer.

### GET `/api/requests/me` (customer)

Query: `status` (one of the request statuses), `page`, `pageSize` (max 50). Returns summaries for the signed-in customer's requests, ordered by most recently updated.

### GET `/api/requests/:id`

Allowed for:

- the owning customer;
- an administrator;
- a provider assigned to the request;
- a provider who has quoted it;
- an approved matching provider that is allowed to quote it.

Other providers receive `403`; customers trying to access another customer's request receive `404`. This prevents existence probing.

### GET `/api/requests/:id/quotes`

Returns the quotes visible to the viewer. Providers see only their own quote; customers and administrators see the full quote list. Access rules match request details.

### PATCH `/api/requests/:id/cancel` (customer)

No body required. The request must belong to the customer and be in `PENDING`, `RESPONDED`, or `ACCEPTED`. Sets status `CANCELLED`, records `cancelledAt`, and declines all pending quotes. Ineligible states return `409 INVALID_TRANSITION`. The accepted quote/assigned provider remain as historical data.

### POST `/api/requests/:id/quotes` (provider)

Requires an approved provider whose active listings cover the category and whose service areas overlap the request location.

```json
{
  "proposedPrice": 95000,
  "priceNotes": "Includes labor and a standard flexible hose.",
  "estimatedDuration": "1–2 hours"
}
```

Rules:

- Request must be `PENDING` or `RESPONDED`.
- One quote per provider per request (`409 ALREADY_QUOTED`).
- A targeted request can only be quoted by its target provider.
- Creating the first quote moves `PENDING` to `RESPONDED` in a transaction.
- Unapproved providers receive `403 PROVIDER_NOT_APPROVED`; out-of-scope requests receive `403`.

Response `201` with a `QuoteDto`.

### PATCH `/api/quotes/:id` (provider)

Body may contain any of `proposedPrice`, `priceNotes`, `estimatedDuration`; at least one field is required. The quote must belong to the provider, still be `PENDING`, and its request must still be `PENDING` or `RESPONDED`. Otherwise `409 QUOTE_CLOSED` or `409 REQUEST_CLOSED`.

### POST `/api/quotes/:id/accept` (customer)

No body required. The quote must be pending on the customer's own request, and the request must be `RESPONDED`. In a transaction:

- the selected quote becomes `ACCEPTED`;
- other pending quotes for the request become `DECLINED`;
- the request becomes `ACCEPTED` and assigns the quote's provider.

Returns the updated request detail. A quote that was already handled returns `409 QUOTE_CLOSED`.

### POST `/api/quotes/:id/decline` (customer)

No body required. Marks one pending quote `DECLINED`. If no pending quotes remain, the request becomes `DECLINED`; otherwise it stays `RESPONDED`. Returns the updated request detail.

### GET job status transitions (provider)

`PATCH /api/requests/:id/status` is a provider endpoint, but it is grouped here for lifecycle clarity.

```json
{ "status": "IN_PROGRESS" }
```

or

```json
{ "status": "COMPLETED" }
```

Only the assigned provider can change the job. `IN_PROGRESS` requires the current status to be `ACCEPTED`; `COMPLETED` requires `IN_PROGRESS`. Other transitions return `409 INVALID_TRANSITION`. Completion records `completedAt`.

### POST `/api/requests/:id/review` (customer)

```json
{ "rating": 5, "comment": "Malinaw at maayos kausap." }
```

Rules:

- Only the request owner can review.
- The request must be `COMPLETED` and have an assigned provider.
- One review per request; a second attempt returns `409 ALREADY_REVIEWED`.
- Rating is an integer from 1 to 5; comment is optional, max 1,000 characters.
- The review is created and provider aggregates are recalculated in one transaction.
- Providers cannot review themselves or their own provider profile.

---

## 7. Customer dashboard, profile, and favorites

### GET `/api/customer/dashboard`

Returns:

```json
{
  "data": {
    "counts": { "open": 2, "active": 1, "completed": 1, "total": 4 },
    "quotesToReview": 2,
    "favorites": 1,
    "recentRequests": []
  }
}
```

`open` combines `PENDING` and `RESPONDED`; `active` combines `ACCEPTED` and `IN_PROGRESS`; `total` includes all statuses. `quotesToReview` counts pending quotes on the customer's `RESPONDED` requests.

### PATCH `/api/customer/me`

```json
{
  "fullName": "Maria Santos",
  "preferredLocationId": "location-id-or-null"
}
```

Both fields are optional, but the endpoint is only meaningful with at least one. `preferredLocationId` must reference an active location when non-null. Returns `{ "data": { "user": { … } } }`.

### GET `/api/favorites`

Returns a paginated list of `ProviderSummary` records for currently approved, active providers saved by the customer.

### POST `/api/favorites/:providerId`

Upserts a favorite. It is idempotent and returns `201` with `{ id, createdAt }`. Only approved providers owned by active provider accounts can be saved; unknown/inactive providers return `404`.

### DELETE `/api/favorites/:providerId`

Removes the favorite if present and returns `204`. Removing an absent favorite is still a no-op success.

---

## 8. Provider self-service

### GET `/api/providers/me`

Returns the provider's own `ProviderSelf`:

- public summary fields;
- `approvalStatus`, `rejectionReason`;
- all own listings (active and inactive);
- portfolio images;
- `verificationRequests` with review notes and reviewer display names;
- `completedJobs`;
- `user`: id, full name, email, emailVerified, isDemo.

Only the signed-in provider's own record is available through `/me`.

### PATCH `/api/providers/me`

```json
{
  "businessName": "Malolos Laptop Care",
  "description": "Home-service laptop repair…",
  "yearsOfExperience": 6
}
```

`businessName` is required. Description max 2,000 characters. Years of experience is a whole number from 0 to 80 or `null`. If the provider's application is `REJECTED`, editing the profile sets it back to `PENDING` and clears the rejection reason. Editing an approved profile does not revoke approval.

### GET `/api/providers/me/dashboard`

Returns:

- `counts`: new opportunities, active jobs, completed jobs, pending quotes, reviews;
- `profile`: approval status, verification status, completeness percentage, and a list of missing profile items;
- `recentRequests`: recent opportunities and engaged requests;
- `recentReviews`: up to three visible reviews.

For an unapproved provider, opportunities are empty and the matching context is not used to expose requests.

### Services

#### POST `/api/providers/me/services`

```json
{
  "categoryId": "…",
  "title": "Laptop diagnostics and repair",
  "description": "Initial check includes storage, memory, and battery health.",
  "startingPrice": 35000,
  "diagnosticFee": 20000,
  "priceType": "STARTING_FROM",
  "requiresInspection": true,
  "isActive": true
}
```

`priceType` is `STARTING_FROM`, `ESTIMATE`, or `FIXED`. Category must be active. Amounts are centavos. Returns `201` with a listing DTO and recalculates the provider's lowest active price.

#### PATCH `/api/providers/me/services/:serviceId`

Partial update of the same fields. At least one field is required. Cannot update another provider's listing (`404`).

#### DELETE `/api/providers/me/services/:serviceId`

Deletes the listing and recalculates provider statistics. Returns `204`. Existing historical requests/quotes do not reference listings directly, so deletion does not erase service history.

### PUT `/api/providers/me/service-areas`

Replaces the provider's entire service-area selection:

```json
{ "locationIds": ["location-a", "location-b"] }
```

Up to 30 unique IDs; all must be active locations. An empty array is allowed. Returns the updated provider self.

### Images

Both endpoints use `multipart/form-data` and accept JPEG, PNG, or WebP files up to `MAX_UPLOAD_MB` (default 5 MB). File contents are validated by magic bytes, not just the declared MIME type.

- `POST /api/providers/me/avatar` with field `avatar`. Replaces the avatar and deletes the previous stored file when it was managed by AyosDito.
- `POST /api/providers/me/portfolio` with field `image` and optional text field `caption` (max 140 characters). Maximum 12 images. Returns `201` with the provider self.
- `DELETE /api/providers/me/portfolio/:imageId` removes the database row and the managed file.

Images are served from `/uploads/<random-name>`. Do not upload identity documents or other sensitive documents. The application deliberately does not provide an identity-document upload endpoint.

### GET `/api/providers/me/requests`

Query parameters:

- `view`: `opportunities` (default), `quotes`, or `jobs`;
- `status`: optional request status;
- `page`, `pageSize`.

Behavior:

- `opportunities`: open `PENDING`/`RESPONDED` requests matching the provider's categories and location scope, excluding targeted requests to other providers and requests the provider already quoted. Unapproved providers get an empty result.
- `quotes`: requests the provider has quoted.
- `jobs`: requests assigned to the provider.

### GET `/api/providers/me/reviews`

Paginated visible reviews for the provider. Customer names are shortened.

### PATCH `/api/providers/me/reviews/:reviewId/response`

```json
{ "response": "Salamat po. Message us if the issue returns." }
```

Response is 10–1,000 characters. The review must belong to the provider and currently be visible. This endpoint can update an existing response.

### POST `/api/providers/me/verifications`

```json
{
  "verificationType": "IDENTITY",
  "note": "I can present a government-issued ID and proof of address for an in-person or video check."
}
```

`verificationType` is `IDENTITY` or `BUSINESS`. Note is 20–1,000 characters.

Rules:

- Provider application must be `APPROVED`.
- The requested type must not already be approved.
- No pending request of the same type is allowed.
- No documents are uploaded or stored.
- Only an administrator decision creates a badge; submission alone does not.

---

## 9. Reports

Reports require an authenticated account and are rate-limited as writes.

### POST `/api/reports`

```json
{
  "entityType": "PROVIDER",
  "entityId": "provider-id",
  "reason": "MISLEADING_INFO",
  "description": "The listed service area and price do not match the profile."
}
```

`entityType`: `PROVIDER` or `REVIEW`.

`reason`: `SCAM_OR_FRAUD`, `ABUSIVE_CONTENT`, `MISLEADING_INFO`, `SPAM`, or `OTHER`.

Rules:

- Description is 10–1,000 characters.
- An account cannot have two open reports for the same entity (`409 REPORT_ALREADY_OPEN`).
- A provider cannot report its own provider profile (`400 CANNOT_REPORT_SELF`).
- A review must exist and be visible; an author cannot report their own review.
- Returns `201` with `{ id, status, createdAt }`.

### POST `/api/reviews/:id/report`

Convenience route for review reports:

```json
{ "reason": "ABUSIVE_CONTENT", "description": "The comment includes personal attacks." }
```

Same duplicate/self-report rules apply.

Reports do not automatically hide content. An administrator must resolve or dismiss them.

---

## 10. Administrator endpoints

All routes in this section require `ADMIN`. The server verifies the role before every handler. Administrative mutations are written to the audit log in the same database transaction as the change where the implementation uses a transaction.

### GET `/api/admin/dashboard`

Returns:

- `counts`: users, customers, providers, admins, suspended users, pending/approved providers, open requests, active jobs, completed requests, visible reviews, open reports;
- `requestsByStatus`: a complete count for every request status;
- `pendingProviders`: up to five applications;
- `openReports`: up to five open reports;
- `recentAudit`: eight latest audit entries.

### Users

#### GET `/api/admin/users`

Query: `q` (name/email/business name), `role` (`CUSTOMER`/`PROVIDER`/`ADMIN`), `status` (`ACTIVE`/`SUSPENDED`), `page`, `pageSize` (max 50).

Returns paginated `AdminUserDto` records. Administrator email addresses are visible only through administrator endpoints.

#### PATCH `/api/admin/users/:id/status`

```json
{ "accountStatus": "SUSPENDED", "reason": "Repeated abusive messages" }
```

- Suspension requires a reason of at least three characters.
- Cannot change your own status (`400 CANNOT_MODIFY_SELF`).
- Cannot suspend another administrator (`403 ADMIN_PROTECTED`).
- Suspending deletes all of that user's sessions.
- Reactivation sets `ACTIVE`; reason is optional.
- Audited as `user.status_changed`.

#### POST `/api/admin/users/:id/grant-admin`

```json
{ "role": "ADMIN" }
```

Eligibility:

- target exists and is not already an administrator;
- target is currently a `CUSTOMER`;
- account is `ACTIVE`;
- email is verified.

Promotion deletes the target's sessions, requires the target to sign in again, and writes `user.admin_granted` to the audit log. There is no public endpoint to create an administrator.

### Providers

#### GET `/api/admin/providers`

Query: `q`, `status` (`PENDING`/`APPROVED`/`REJECTED`), `page`, `pageSize`.

Returns provider summaries plus application status, rejection reason, and owner account details.

#### PATCH `/api/admin/providers/:id/approval`

```json
{ "approvalStatus": "APPROVED" }
```

or

```json
{ "approvalStatus": "REJECTED", "reason": "The service area and business details could not be confirmed." }
```

Rejection requires a reason. Approval sets `approvedAt` and clears any rejection reason; rejection clears `approvedAt` and stores the reason. The target must still have the provider role. Audited as `provider.approved` or `provider.rejected`.

### Verification requests

#### GET `/api/admin/verifications`

Query: `status` (`PENDING`/`APPROVED`/`REJECTED`), `page`, `pageSize`.

Each row includes the provider, type, provider note, reviewer note, reviewer name, and timestamps.

#### PATCH `/api/admin/verifications/:id`

```json
{ "status": "APPROVED", "reviewNote": "ID and business document checked on a video call on 2026-10-26." }
```

or

```json
{ "status": "REJECTED", "reviewNote": "The submitted name did not match the business details." }
```

Rules:

- Only `PENDING` requests can be reviewed (`409 VERIFICATION_CLOSED`).
- Approval requires the provider application to be `APPROVED` (`409 PROVIDER_NOT_APPROVED`).
- Rejection requires a review note.
- Only an approved verification sets `identityVerifiedAt` / `businessVerifiedAt`, updates the derived verification status, and raises the provider's verification rank.
- Audited as `verification.approved` or `verification.rejected`.

### Categories

#### GET `/api/admin/categories`

Returns all categories with `listingCount`, `requestCount`, and timestamps.

#### POST `/api/admin/categories`

```json
{
  "name": "Aircon Services",
  "description": "Cleaning and repair for window and split-type units.",
  "icon": "wind",
  "isActive": true,
  "sortOrder": 50
}
```

A unique slug is generated from the name and cannot be edited afterward. Defaults: `icon: "wrench"`, `isActive: true`, `sortOrder: 0`. Audited as `category.created`.

#### PATCH `/api/admin/categories/:id`

Partial update of `name`, `description`, `icon`, `isActive`, `sortOrder`. Deactivating a category makes its listings/categories disappear from public discovery and recalculates affected provider minimum prices. Audited as `category.updated`.

### Locations

#### GET `/api/admin/locations`

Returns all locations with parent name, child count, service-area count, request count, and timestamps.

#### POST `/api/admin/locations`

```json
{
  "name": "San Jose del Monte",
  "locationType": "CITY",
  "parentId": "bulacan-province-id",
  "isActive": true
}
```

Allowed parent relationships:

- `REGION`: no parent;
- `PROVINCE`: parent must be a `REGION`;
- `CITY`: parent must be a `REGION` or `PROVINCE`;
- `BARANGAY`: parent must be a `CITY`.

An active child requires an active parent. Audited as `location.created`.

#### PATCH `/api/admin/locations/:id`

Partial update of `name`, `locationType`, `parentId`, `isActive`. Moving a location checks hierarchy and prevents cycles. Deactivating a location recursively deactivates descendants; reactivating a parent does not automatically reactivate children. Audited as `location.updated` with the count of deactivated descendants when applicable.

### Reviews

#### GET `/api/admin/reviews`

Query: `q` (comment, customer full name, or provider business name), `moderationStatus` (`VISIBLE`/`HIDDEN`), `page`, `pageSize`.

Administrator review rows include author id/full name/email/isDemo, provider, rating, comment, status, and provider response.

#### PATCH `/api/admin/reviews/:id/moderation`

```json
{ "moderationStatus": "HIDDEN", "reason": "Contains personal contact information." }
```

- Hiding requires a reason.
- Showing a review returns it to public lists.
- Every change recalculates the provider's rating aggregate in the same transaction.
- Audited as `review.moderated`.

### Reports

#### GET `/api/admin/reports`

Query: `status` (`OPEN`/`RESOLVED`/`DISMISSED`), `page`, `pageSize`.

Each report includes reporter details, reason, description, status, target preview, reviewer, resolution note, and timestamps. A deleted target may produce a `null` preview.

#### PATCH `/api/admin/reports/:id`

```json
{ "status": "RESOLVED", "resolutionNote": "Provider profile corrected and the reporter was informed." }
```

Only open reports can be updated (`409 REPORT_CLOSED`). Resolution note is 3–500 characters. Audited as `report.resolved` with the chosen status and note. Resolving a report does not automatically hide the review or suspend the provider; an administrator must use the relevant moderation action.

### Audit log

#### GET `/api/admin/audit-logs`

Query: `q` (action, entity type, exact entity id, actor name, or actor email), `page`, `pageSize`.

Newest first. Each entry contains actor (or null if deleted), action, entity type/id, parsed JSON metadata, and timestamp.

The audit log records administrator actions implemented in the admin routes. Authentication events and ordinary marketplace lifecycle events are not written to it.

---

## 11. Error reference

| HTTP | Code | Meaning |
| --- | --- | --- |
| 400 | `INVALID_ID` | Malformed identifier parameter |
| 400 | `INVALID_CATEGORY`, `INVALID_LOCATION`, `INVALID_LOCATION_PARENT`, `INACTIVE_LOCATION_PARENT`, `LOCATION_CYCLE` | Catalog/selection validation |
| 400 | `INVALID_FILE`, `NO_FILE`, `LIMIT_FILE_SIZE` | Upload validation |
| 400 | `INVALID_JSON` | Unparseable JSON request body |
| 400 | `INVALID_RESET_TOKEN`, `INVALID_VERIFICATION_TOKEN`, `INVALID_PASSWORD` | Auth token/password failure |
| 400 | `CANNOT_REPORT_SELF`, `CANNOT_MODIFY_SELF` | Self-targeting guard |
| 401 | `UNAUTHORIZED` | Not signed in |
| 403 | `FORBIDDEN` | Role or ownership/scope failure |
| 403 | `CSRF_FAILED`, `ORIGIN_NOT_ALLOWED` | CSRF/origin protection |
| 403 | `ACCOUNT_SUSPENDED`, `ADMIN_PROTECTED` | Account/security guard |
| 404 | `NOT_FOUND` | Record missing or intentionally hidden |
| 409 | `EMAIL_IN_USE`, `ALREADY_QUOTED`, `ALREADY_REVIEWED`, `QUOTE_CLOSED`, `REQUEST_CLOSED`, `INVALID_TRANSITION`, `REVIEW_NOT_ALLOWED` | Business-state conflicts |
| 409 | `VERIFICATION_PENDING`, `ALREADY_VERIFIED`, `VERIFICATION_CLOSED`, `REPORT_ALREADY_OPEN`, `REPORT_CLOSED`, `PORTFOLIO_LIMIT`, `ALREADY_ADMIN`, `ROLE_NOT_ELIGIBLE`, `ACCOUNT_INACTIVE`, `EMAIL_NOT_VERIFIED` | Workflow conflicts |
| 403 / 409 | `PROVIDER_NOT_APPROVED` | Provider not approved: `403` when quoting, `409` when requesting or reviewing a verification badge |
| 422 | `VALIDATION_ERROR` | Invalid request body; see `details.fieldErrors` |
| 422 | `INVALID_QUERY` | Invalid query/filter values |
| 429 | `RATE_LIMITED` | Too many requests in the current window |
| 500 | `INTERNAL_ERROR` | Unexpected server failure; safe message only |

Not every route uses every code, and some validation failures carry route-specific messages. Use the HTTP status plus the `code` field for programmatic handling; show `message` to users. Log the `requestId` when investigating.

Rate limits are per client and in memory:

- general API: 900 requests / 15 minutes;
- authentication: 30 / 15 minutes;
- password recovery (and resend verification): 10 / hour;
- writes: 180 / 15 minutes (GET/HEAD/OPTIONS skipped).

Limits reset when the API restarts and are not shared across processes.

---

## 12. Notes for client developers

- Always include cookies (`credentials: "include"` for cross-origin development).
- Fetch `/api/auth/csrf` or read the cookie before a mutation; retry once after refreshing a rejected CSRF token. The included client does this.
- Treat 401/403 as session/role failures; load the current user with `/api/auth/me`.
- Never trust client-side role checks or hidden buttons for authorization.
- Do not send more than one provider quote for a request.
- Use the permission flags in request details to render actions, but expect the server to reject stale actions with a 409.
- Handle 409 conflicts by refetching the request. Lifecycle state may have changed in another tab.
- Display demo flags and verification state honestly. Do not convert a missing badge into “verified.”
- Do not add addresses, identity documents, or sensitive personal data to fields that are publicly visible.

For a full walkthrough of setup and production notes, see the [README](../README.md) and [deployment guide](DEPLOYMENT.md).

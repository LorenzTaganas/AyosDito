import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma';
import {
  clientFor,
  createCatalog,
  createProvider,
  createRequestRecord,
  createUser,
  resetDatabase,
} from './helpers';

let catalog: Awaited<ReturnType<typeof createCatalog>>;
let customerA: Awaited<ReturnType<typeof createUser>>;
let customerB: Awaited<ReturnType<typeof createUser>>;
let admin: Awaited<ReturnType<typeof createUser>>;
let providerA: Awaited<ReturnType<typeof createProvider>>;
let providerB: Awaited<ReturnType<typeof createProvider>>;
let providerOutside: Awaited<ReturnType<typeof createProvider>>;
let laptopProvider: Awaited<ReturnType<typeof createProvider>>;

beforeEach(async () => {
  await resetDatabase();
  catalog = await createCatalog();
  customerA = await createUser({ email: 'customer.a@example.test', fullName: 'Maria Customer' });
  customerB = await createUser({ email: 'customer.b@example.test', fullName: 'Carlo Customer' });
  admin = await createUser({ email: 'admin@example.test', fullName: 'Admin User', role: 'ADMIN' });
  providerA = await createProvider({
    email: 'provider.a@example.test',
    businessName: 'Provider A Plumbing',
    categoryIds: [catalog.plumbing.id],
    locationIds: [catalog.cityA.id],
    startingPrice: 50000,
  });
  providerB = await createProvider({
    email: 'provider.b@example.test',
    businessName: 'Provider B Plumbing',
    categoryIds: [catalog.plumbing.id],
    locationIds: [catalog.cityA.id],
    startingPrice: 70000,
  });
  providerOutside = await createProvider({
    email: 'provider.outside@example.test',
    businessName: 'Outside City Plumbing',
    categoryIds: [catalog.plumbing.id],
    locationIds: [catalog.cityB.id],
  });
  laptopProvider = await createProvider({
    email: 'provider.laptop@example.test',
    businessName: 'Laptop Specialist',
    categoryIds: [catalog.laptop.id],
    locationIds: [catalog.cityA.id],
  });
});

const REQUEST_BODY = {
  title: 'Tumutulo ang tubo sa ilalim ng lababo',
  problemDescription: 'The pipe under the kitchen sink is leaking and the cabinet is getting wet.',
  preferredSchedule: 'Weekend morning',
};

async function submitRequest(
  client: Awaited<ReturnType<typeof clientFor>>,
  overrides: Record<string, unknown> = {},
) {
  const response = await client
    .post('/api/requests', {
      ...REQUEST_BODY,
      categoryId: catalog.plumbing.id,
      locationId: catalog.cityA.id,
      ...overrides,
    })
    .expect(201);
  return response.body.data as {
    id: string;
    status: string;
    quotes: { id: string; provider: { id: string }; status: string }[];
  };
}

describe('service request privacy and creation', () => {
  it('creates a request and hides it from other customers and non-matching providers', async () => {
    const owner = await clientFor(customerA.email);
    const otherCustomer = await clientFor(customerB.email);
    const matching = await clientFor(providerA.email);
    const wrongCategory = await clientFor(laptopProvider.email);
    const wrongArea = await clientFor(providerOutside.email);

    const request = await submitRequest(owner);
    expect(request.status).toBe('PENDING');

    await otherCustomer.get(`/api/requests/${request.id}`).expect(404);
    await wrongCategory.get(`/api/requests/${request.id}`).expect(403);
    await wrongArea.get(`/api/requests/${request.id}`).expect(403);

    const providerView = await matching.get(`/api/requests/${request.id}`).expect(200);
    expect(providerView.body.data.customer.contactEmail).toBeNull();
    expect(providerView.body.data.permissions.canQuote).toBe(true);
    expect(providerView.body.data.quotes).toEqual([]);

    const ownerView = await owner.get(`/api/requests/${request.id}`).expect(200);
    expect(ownerView.body.data.customer.contactEmail).toBe(customerA.email);

    const adminView = await clientFor(admin.email);
    await adminView.get(`/api/requests/${request.id}`).expect(200);

    await otherCustomer.patch(`/api/requests/${request.id}/cancel`, {}).expect(404);
    await matching.patch(`/api/requests/${request.id}/cancel`, {}).expect(403);
  });

  it('validates category, location, and target provider coverage', async () => {
    const owner = await clientFor(customerA.email);

    const invalidCategory = await owner
      .post('/api/requests', {
        ...REQUEST_BODY,
        categoryId: 'unknown',
        locationId: catalog.cityA.id,
      })
      .expect(400);
    expect(invalidCategory.body.error.code).toBe('INVALID_CATEGORY');

    const invalidLocation = await owner
      .post('/api/requests', {
        ...REQUEST_BODY,
        categoryId: catalog.plumbing.id,
        locationId: 'unknown',
      })
      .expect(400);
    expect(invalidLocation.body.error.code).toBe('INVALID_LOCATION');

    const wrongTarget = await owner
      .post('/api/requests', {
        ...REQUEST_BODY,
        categoryId: catalog.plumbing.id,
        locationId: catalog.cityA.id,
        targetProviderId: laptopProvider.id,
      })
      .expect(400);
    expect(wrongTarget.body.error.code).toBe('TARGET_PROVIDER_UNAVAILABLE');

    const providerClient = await clientFor(providerA.email);
    await providerClient
      .post('/api/requests', {
        ...REQUEST_BODY,
        categoryId: catalog.plumbing.id,
        locationId: catalog.cityA.id,
      })
      .expect(403);
  });

  it('restricts targeted requests to the chosen provider', async () => {
    const owner = await clientFor(customerA.email);
    const target = await clientFor(providerB.email);
    const otherProvider = await clientFor(providerA.email);

    const request = await submitRequest(owner, { targetProviderId: providerB.id });

    await otherProvider.get(`/api/requests/${request.id}`).expect(403);
    await target.get(`/api/requests/${request.id}`).expect(200);

    await otherProvider
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 90000 })
      .expect(403);
    await target.post(`/api/requests/${request.id}/quotes`, { proposedPrice: 90000 }).expect(201);
  });
});

describe('quote comparison, acceptance, and job completion', () => {
  it('lets a customer compare quotes and accept exactly one', async () => {
    const owner = await clientFor(customerA.email);
    const quoteProviderA = await clientFor(providerA.email);
    const quoteProviderB = await clientFor(providerB.email);
    const outside = await clientFor(providerOutside.email);

    const request = await submitRequest(owner);

    const quoteA = await quoteProviderA
      .post(`/api/requests/${request.id}/quotes`, {
        proposedPrice: 95000,
        priceNotes: 'Labor and a standard hose included.',
        estimatedDuration: '1–2 hours',
      })
      .expect(201);
    const quoteB = await quoteProviderB
      .post(`/api/requests/${request.id}/quotes`, {
        proposedPrice: 75000,
        priceNotes: 'Labor only; parts quoted after inspection.',
        estimatedDuration: 'Same day',
      })
      .expect(201);

    await quoteProviderA
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 80000 })
      .expect(409);
    await outside
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 80000 })
      .expect(403);

    const customerQuotes = await owner.get(`/api/requests/${request.id}/quotes`).expect(200);
    expect(customerQuotes.body.data).toHaveLength(2);

    const providerAView = await quoteProviderA.get(`/api/requests/${request.id}`).expect(200);
    expect(providerAView.body.data.quotes).toHaveLength(1);
    expect(providerAView.body.data.quotes[0].id).toBe(quoteA.body.data.id);
    expect(providerAView.body.data.customer.contactEmail).toBeNull();

    const updatedQuote = await quoteProviderA
      .patch(`/api/quotes/${quoteA.body.data.id}`, { proposedPrice: 90000 })
      .expect(200);
    expect(updatedQuote.body.data.proposedPrice).toBe(90000);

    await quoteProviderB
      .patch(`/api/quotes/${quoteA.body.data.id}`, { proposedPrice: 10000 })
      .expect(404);

    const accepted = await owner
      .post(`/api/quotes/${quoteB.body.data.id}/accept`, {})
      .expect(200);
    expect(accepted.body.data.status).toBe('ACCEPTED');
    expect(accepted.body.data.assignedProvider.id).toBe(providerB.id);
    expect(accepted.body.data.customer.contactEmail).toBe(customerA.email);
    expect(accepted.body.data.assignedProvider.contactEmail).toBe(providerB.user.email);
    const quoteStatuses = Object.fromEntries(
      accepted.body.data.quotes.map((quote: { id: string; status: string }) => [quote.id, quote.status]),
    );
    expect(quoteStatuses[quoteA.body.data.id]).toBe('DECLINED');
    expect(quoteStatuses[quoteB.body.data.id]).toBe('ACCEPTED');

    const acceptedView = await quoteProviderB.get(`/api/requests/${request.id}`).expect(200);
    expect(acceptedView.body.data.customer.contactEmail).toBe(customerA.email);

    const losingProviderView = await quoteProviderA.get(`/api/requests/${request.id}`).expect(200);
    expect(losingProviderView.body.data.customer.contactEmail).toBeNull();
    expect(losingProviderView.body.data.quotes).toHaveLength(1);

    await owner.post(`/api/quotes/${quoteA.body.data.id}/accept`, {}).expect(409);
    await owner.post(`/api/quotes/${quoteB.body.data.id}/decline`, {}).expect(409);

    const adminView = await clientFor(admin.email);
    const adminRequest = await adminView.get(`/api/requests/${request.id}`).expect(200);
    expect(adminRequest.body.data.quotes).toHaveLength(2);
    expect(adminRequest.body.data.customer.contactEmail).toBeNull();
  });

  it('enforces provider ownership and valid job transitions', async () => {
    const owner = await clientFor(customerA.email);
    const assigned = await clientFor(providerB.email);
    const otherProvider = await clientFor(providerA.email);

    const request = await submitRequest(owner);
    const quote = await assigned
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 85000 })
      .expect(201);
    await owner.post(`/api/quotes/${quote.body.data.id}/accept`, {}).expect(200);

    await assigned.patch(`/api/requests/${request.id}/status`, { status: 'COMPLETED' }).expect(409);
    await otherProvider.patch(`/api/requests/${request.id}/status`, { status: 'IN_PROGRESS' }).expect(404);
    await owner.patch(`/api/requests/${request.id}/status`, { status: 'IN_PROGRESS' }).expect(403);

    const started = await assigned
      .patch(`/api/requests/${request.id}/status`, { status: 'IN_PROGRESS' })
      .expect(200);
    expect(started.body.data.status).toBe('IN_PROGRESS');

    await owner.patch(`/api/requests/${request.id}/cancel`, {}).expect(409);

    const completed = await assigned
      .patch(`/api/requests/${request.id}/status`, { status: 'COMPLETED' })
      .expect(200);
    expect(completed.body.data.status).toBe('COMPLETED');
    expect(completed.body.data.completedAt).toBeTruthy();

    await assigned.patch(`/api/requests/${request.id}/status`, { status: 'IN_PROGRESS' }).expect(409);
  });

  it('allows one review only, by the customer, after completion', async () => {
    const owner = await clientFor(customerA.email);
    const otherCustomer = await clientFor(customerB.email);
    const assigned = await clientFor(providerB.email);

    const request = await submitRequest(owner);
    const quote = await assigned
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 85000 })
      .expect(201);
    await owner.post(`/api/quotes/${quote.body.data.id}/accept`, {}).expect(200);

    const tooEarly = await owner
      .post(`/api/requests/${request.id}/review`, { rating: 5 })
      .expect(409);
    expect(tooEarly.body.error.code).toBe('REVIEW_NOT_ALLOWED');

    await assigned.patch(`/api/requests/${request.id}/status`, { status: 'IN_PROGRESS' }).expect(200);
    await assigned.patch(`/api/requests/${request.id}/status`, { status: 'COMPLETED' }).expect(200);

    await otherCustomer.post(`/api/requests/${request.id}/review`, { rating: 5 }).expect(404);
    await assigned.post(`/api/requests/${request.id}/review`, { rating: 5 }).expect(403);

    const review = await owner
      .post(`/api/requests/${request.id}/review`, {
        rating: 5,
        comment: 'Maayos ang gawa at malinaw ang presyo bago magsimula.',
      })
      .expect(201);
    expect(review.body.data.customerDisplayName).toBe('Maria C.');

    await owner.post(`/api/requests/${request.id}/review`, { rating: 4 }).expect(409);

    const response = await assigned
      .patch(`/api/providers/me/reviews/${review.body.data.id}/response`, {
        response: 'Salamat po. Message lang kung may iba pang kailangan.',
      })
      .expect(200);
    expect(response.body.data.providerResponse).toContain('Salamat');

    const publicProfile = await otherCustomer.get(`/api/providers/${providerB.id}`).expect(200);
    expect(publicProfile.body.data.reviewCount).toBe(1);
    expect(publicProfile.body.data.recentReviews[0].providerResponse).toContain('Salamat');
    expect(JSON.stringify(publicProfile.body.data)).not.toContain(customerA.email);
  });
});

describe('declines, cancellation, and history', () => {
  it('declines quotes and closes the request when none remain', async () => {
    const owner = await clientFor(customerA.email);
    const quoteProviderA = await clientFor(providerA.email);
    const quoteProviderB = await clientFor(providerB.email);

    const request = await submitRequest(owner);
    const quoteA = await quoteProviderA
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 60000 })
      .expect(201);
    const quoteB = await quoteProviderB
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 70000 })
      .expect(201);

    const afterFirst = await owner
      .post(`/api/quotes/${quoteA.body.data.id}/decline`, {})
      .expect(200);
    expect(afterFirst.body.data.status).toBe('RESPONDED');

    const afterSecond = await owner
      .post(`/api/quotes/${quoteB.body.data.id}/decline`, {})
      .expect(200);
    expect(afterSecond.body.data.status).toBe('DECLINED');
    expect(afterSecond.body.data.quotes.every((quote: { status: string }) => quote.status === 'DECLINED')).toBe(true);

    await owner.post(`/api/quotes/${quoteB.body.data.id}/accept`, {}).expect(409);
    await quoteProviderA
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 50000 })
      .expect(409);
    await quoteProviderA
      .patch(`/api/quotes/${quoteA.body.data.id}`, { proposedPrice: 50000 })
      .expect(409);
    await owner.patch(`/api/requests/${request.id}/cancel`, {}).expect(409);
  });

  it('cancels open requests, declines their quotes, and blocks later activity', async () => {
    const owner = await clientFor(customerA.email);
    const otherCustomer = await clientFor(customerB.email);
    const quoteProvider = await clientFor(providerA.email);

    const request = await submitRequest(owner);
    const quote = await quoteProvider
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 60000 })
      .expect(201);

    await otherCustomer.patch(`/api/requests/${request.id}/cancel`, {}).expect(404);
    const cancelled = await owner.patch(`/api/requests/${request.id}/cancel`, {}).expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(cancelled.body.data.quotes[0].status).toBe('DECLINED');

    await quoteProvider
      .patch(`/api/quotes/${quote.body.data.id}`, { proposedPrice: 55000 })
      .expect(409);
    await quoteProvider
      .post(`/api/requests/${request.id}/quotes`, { proposedPrice: 55000 })
      .expect(409);
    await owner.patch(`/api/requests/${request.id}/cancel`, {}).expect(409);

    const completed = await createRequestRecord({
      customerId: customerA.id,
      categoryId: catalog.plumbing.id,
      locationId: catalog.cityA.id,
      status: 'COMPLETED',
      assignedProviderId: providerA.id,
    });
    await owner.patch(`/api/requests/${completed.id}/cancel`, {}).expect(409);
  });
});

describe('provider request inbox', () => {
  it('shows only matching open opportunities and removes requests after quoting', async () => {
    const owner = await clientFor(customerA.email);
    const matching = await clientFor(providerA.email);
    const wrongCategory = await clientFor(laptopProvider.email);
    const outside = await clientFor(providerOutside.email);

    const request = await submitRequest(owner);

    const opportunities = await matching.get('/api/providers/me/requests?view=opportunities').expect(200);
    expect(opportunities.body.data.map((row: { id: string }) => row.id)).toContain(request.id);
    expect(opportunities.body.meta.total).toBe(1);

    const wrongCategoryInbox = await wrongCategory
      .get('/api/providers/me/requests?view=opportunities')
      .expect(200);
    expect(wrongCategoryInbox.body.meta.total).toBe(0);
    const outsideInbox = await outside.get('/api/providers/me/requests?view=opportunities').expect(200);
    expect(outsideInbox.body.meta.total).toBe(0);

    await matching.post(`/api/requests/${request.id}/quotes`, { proposedPrice: 65000 }).expect(201);

    const afterQuote = await matching.get('/api/providers/me/requests?view=opportunities').expect(200);
    expect(afterQuote.body.meta.total).toBe(0);

    const quotes = await matching.get('/api/providers/me/requests?view=quotes').expect(200);
    expect(quotes.body.data).toHaveLength(1);
    expect(quotes.body.data[0].myQuoteStatus).toBe('PENDING');
    expect(quotes.body.data[0].quoteCount).toBe(1);

    const dashboard = await matching.get('/api/providers/me/dashboard').expect(200);
    expect(dashboard.body.data.counts.pendingQuotes).toBe(1);
    expect(dashboard.body.data.counts.newOpportunities).toBe(0);
  });

  it('never includes another customer’s or another provider’s private records', async () => {
    const owner = await clientFor(customerA.email);
    const quoteProvider = await clientFor(providerA.email);

    const request = await submitRequest(owner);
    await quoteProvider.post(`/api/requests/${request.id}/quotes`, { proposedPrice: 65000 }).expect(201);

    const otherCustomer = await clientFor(customerB.email);
    const list = await otherCustomer.get('/api/requests/me').expect(200);
    expect(list.body.meta.total).toBe(0);

    await otherCustomer.get(`/api/requests/${request.id}/quotes`).expect(404);
    await otherCustomer.get('/api/providers/me').expect(403);
  });
});

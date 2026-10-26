import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma';
import {
  addReview,
  clientFor,
  createCatalog,
  createClient,
  createProvider,
  createUser,
  resetDatabase,
} from './helpers';

let catalog: Awaited<ReturnType<typeof createCatalog>>;

beforeEach(async () => {
  await resetDatabase();
  catalog = await createCatalog();
});

async function seedDirectory() {
  const customers = await Promise.all([
    createUser({ email: 'r1@example.test', fullName: 'Reviewer One' }),
    createUser({ email: 'r2@example.test', fullName: 'Reviewer Two' }),
    createUser({ email: 'r3@example.test', fullName: 'Reviewer Three' }),
    createUser({ email: 'r4@example.test', fullName: 'Reviewer Four' }),
  ]);

  const alpha = await createProvider({
    email: 'alpha@example.test',
    businessName: 'Alpha Laptop Care',
    categoryIds: [catalog.laptop.id, catalog.aircon.id],
    locationIds: [catalog.cityA.id],
    startingPrice: 90000,
    identityVerified: true,
  });

  const pending = await createProvider({
    email: 'pending@example.test',
    businessName: 'Pending Provider',
    categoryIds: [catalog.laptop.id],
    locationIds: [catalog.cityA.id],
    approvalStatus: 'PENDING',
  });

  const pricey = await createProvider({
    email: 'pricey@example.test',
    businessName: 'Pricey Aircon',
    categoryIds: [catalog.aircon.id],
    locationIds: [catalog.cityA.id],
    startingPrice: 400000,
  });

  const barangayProvider = await createProvider({
    email: 'barangay@example.test',
    businessName: 'Barangay Plumber',
    categoryIds: [catalog.plumbing.id],
    locationIds: [catalog.barangayA.id],
    startingPrice: 60000,
  });

  await createProvider({
    email: 'nolistings@example.test',
    businessName: 'No Listings Yet',
    categoryIds: [],
    locationIds: [catalog.cityA.id],
  });

  await addReview({ providerId: alpha.id, customerId: customers[0].id, rating: 5 });
  await addReview({ providerId: alpha.id, customerId: customers[1].id, rating: 4 });
  await addReview({ providerId: alpha.id, customerId: customers[2].id, rating: 5 });
  await addReview({ providerId: pricey.id, customerId: customers[3].id, rating: 5 });

  return { alpha, pending, pricey, barangayProvider, customers };
}

describe('public provider directory', () => {
  it('lists only approved, active providers with active listings', async () => {
    const { alpha, pending } = await seedDirectory();
    const client = await clientFor('r1@example.test');

    const response = await client.get('/api/providers?pageSize=24').expect(200);
    const names = response.body.data.map((provider: { businessName: string }) => provider.businessName);
    expect(names).toContain('Alpha Laptop Care');
    expect(names).not.toContain('Pending Provider');
    expect(names).not.toContain('No Listings Yet');
    expect(response.body.data.find((provider: { id: string }) => provider.id === alpha.id).reviewCount).toBe(3);
    expect(response.body.meta.includesDemoData).toBe(false);

    const pendingDetail = await client.get(`/api/providers/${pending.id}`).expect(404);
    expect(pendingDetail.body.error.code).toBe('NOT_FOUND');

    await client.get(`/api/providers/${alpha.id}`).expect(200);
  });

  it('filters by category, location hierarchy, keyword, and price range', async () => {
    const { alpha, barangayProvider } = await seedDirectory();
    const client = await clientFor('r1@example.test');

    const category = await client.get('/api/providers?category=aircon-services').expect(200);
    expect(category.body.data.map((provider: { businessName: string }) => provider.businessName)).toEqual(
      expect.arrayContaining(['Alpha Laptop Care', 'Pricey Aircon']),
    );
    expect(category.body.data.map((provider: { businessName: string }) => provider.businessName)).not.toContain(
      'Barangay Plumber',
    );

    const citySearch = await client.get(`/api/providers?locationId=${catalog.cityA.id}`).expect(200);
    const cityNames = citySearch.body.data.map((provider: { id: string }) => provider.id);
    expect(cityNames).toContain(alpha.id);
    expect(cityNames).toContain(barangayProvider.id);

    const barangaySearch = await client.get(`/api/providers?locationId=${catalog.barangayA.id}`).expect(200);
    expect(barangaySearch.body.data.map((provider: { id: string }) => provider.id)).toContain(alpha.id);

    const keyword = await client.get('/api/providers?q=Alpha').expect(200);
    expect(keyword.body.data).toHaveLength(1);
    expect(keyword.body.data[0].businessName).toBe('Alpha Laptop Care');

    const price = await client.get('/api/providers?minPrice=50000&maxPrice=150000').expect(200);
    const priceNames = price.body.data.map((provider: { businessName: string }) => provider.businessName);
    expect(priceNames).toContain('Alpha Laptop Care');
    expect(priceNames).not.toContain('Pricey Aircon');
  });

  it('requires at least three reviews for rating filters and sorting', async () => {
    await seedDirectory();
    const client = await clientFor('r1@example.test');

    const filtered = await client.get('/api/providers?minRating=4').expect(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].businessName).toBe('Alpha Laptop Care');

    const sorted = await client.get('/api/providers?sort=rating').expect(200);
    expect(sorted.body.data).toHaveLength(1);
    expect(sorted.body.data[0].reviewCount).toBe(3);
  });

  it('filters verification state and paginates results', async () => {
    await seedDirectory();
    const client = await clientFor('r1@example.test');

    const verified = await client.get('/api/providers?verified=identity').expect(200);
    expect(verified.body.data).toHaveLength(1);
    expect(verified.body.data[0].businessName).toBe('Alpha Laptop Care');

    const firstPage = await client.get('/api/providers?page=1&pageSize=2').expect(200);
    expect(firstPage.body.data).toHaveLength(2);
    expect(firstPage.body.meta.total).toBe(3);
    expect(firstPage.body.meta.totalPages).toBe(2);

    const secondPage = await client.get('/api/providers?page=2&pageSize=2').expect(200);
    expect(secondPage.body.data).toHaveLength(1);
    expect(secondPage.body.data[0].id).not.toBe(firstPage.body.data[0].id);
  });

  it('returns clear errors for invalid filters', async () => {
    const client = await createClient();
    const category = await client.get('/api/providers?category=unknown-category').expect(400);
    expect(category.body.error.code).toBe('INVALID_CATEGORY');

    const location = await client.get('/api/providers?locationId=missing-location').expect(400);
    expect(location.body.error.code).toBe('INVALID_LOCATION');

    const price = await client.get('/api/providers?minPrice=200000&maxPrice=100000').expect(422);
    expect(price.body.error.code).toBe('INVALID_QUERY');
  });

  it('excludes hidden reviews from the public profile and rating', async () => {
    const { alpha, customers } = await seedDirectory();
    const hidden = await prisma.review.findFirst({
      where: { providerId: alpha.id, customerId: customers[0].id },
    });
    await prisma.review.update({ where: { id: hidden!.id }, data: { moderationStatus: 'HIDDEN' } });
    const { recalcProviderStats } = await import('../src/services/providerStats');
    await recalcProviderStats(alpha.id);

    const client = await clientFor('r2@example.test');
    const detail = await client.get(`/api/providers/${alpha.id}`).expect(200);
    expect(detail.body.data.reviewCount).toBe(2);
    expect(detail.body.data.recentReviews).toHaveLength(2);

    const reviews = await client.get(`/api/providers/${alpha.id}/reviews`).expect(200);
    expect(reviews.body.data).toHaveLength(2);
    expect(reviews.body.meta.total).toBe(2);
  });
});

describe('provider self-service access', () => {
  it('returns only the signed-in provider profile', async () => {
    const alpha = await createProvider({
      email: 'self@example.test',
      businessName: 'Self Service Provider',
      categoryIds: [catalog.laptop.id],
      locationIds: [catalog.cityA.id],
    });
    const other = await createProvider({
      email: 'other@example.test',
      businessName: 'Other Provider',
      categoryIds: [catalog.plumbing.id],
      locationIds: [catalog.cityB.id],
    });
    const client = await clientFor('self@example.test');

    const self = await client.get('/api/providers/me').expect(200);
    expect(self.body.data.id).toBe(alpha.id);
    expect(self.body.data.id).not.toBe(other.id);

    const dashboard = await client.get('/api/providers/me/dashboard').expect(200);
    expect(dashboard.body.data.profile.approvalStatus).toBe('APPROVED');
    expect(dashboard.body.data.counts).toBeDefined();
  });

  it('blocks customers and unauthenticated visitors from provider self routes', async () => {
    const customer = await createUser({ email: 'blocked@example.test' });
    const client = await clientFor(customer.email);
    await client.get('/api/providers/me').expect(403);

    const anonymous = await createClient();
    await anonymous.get('/api/providers/me').expect(401);
  });
});

import request from 'supertest';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/prisma';
import { app } from '../src/app';
import { recalcProviderStats } from '../src/services/providerStats';

if (process.env.NODE_ENV !== 'test' || !(process.env.DATABASE_URL ?? '').includes('test.db')) {
  throw new Error(
    'Refusing to run tests without NODE_ENV=test and DATABASE_URL pointing at test.db. Check vitest.config.ts.',
  );
}

export const TEST_PASSWORD = 'TestPassword123';

let passwordHashPromise: Promise<string> | null = null;

export function testPasswordHash(): Promise<string> {
  passwordHashPromise ??= bcrypt.hash(TEST_PASSWORD, 4);
  return passwordHashPromise;
}

export async function resetDatabase(): Promise<void> {
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.review.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.portfolioImage.deleteMany();
  await prisma.providerVerification.deleteMany();
  await prisma.serviceListing.deleteMany();
  await prisma.providerServiceArea.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.customerProfile.deleteMany();
  await prisma.providerProfile.deleteMany();
  for (const locationType of ['BARANGAY', 'CITY', 'PROVINCE', 'REGION']) {
    await prisma.location.deleteMany({ where: { locationType } });
  }
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

export async function createClient() {
  const agent = request.agent(app);
  const response = await agent.get('/api/auth/csrf').expect(200);
  const csrf = response.body.data.token as string;
  return {
    agent,
    csrf,
    get: (url: string) => agent.get(url),
    post: (url: string, body: Record<string, unknown> = {}) =>
      agent.post(url).set('X-CSRF-Token', csrf).send(body),
    patch: (url: string, body: Record<string, unknown> = {}) =>
      agent.patch(url).set('X-CSRF-Token', csrf).send(body),
    put: (url: string, body: Record<string, unknown> = {}) =>
      agent.put(url).set('X-CSRF-Token', csrf).send(body),
    del: (url: string) => agent.delete(url).set('X-CSRF-Token', csrf),
  };
}

export type TestClient = Awaited<ReturnType<typeof createClient>>;

export async function signIn(client: TestClient, email: string, password = TEST_PASSWORD) {
  return client.post('/api/auth/login', { email, password }).expect(200);
}

export async function clientFor(email: string, password = TEST_PASSWORD): Promise<TestClient> {
  const client = await createClient();
  await signIn(client, email, password);
  return client;
}

export async function createCatalog() {
  const [laptop, plumbing, aircon] = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Laptop & Computer Repair',
        slug: 'laptop-computer-repair',
        icon: 'laptop',
        description: 'Laptop and desktop repair.',
        sortOrder: 10,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Plumbing Services',
        slug: 'plumbing-services',
        icon: 'droplets',
        description: 'Leaks, clogs, and pipes.',
        sortOrder: 20,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Aircon Services',
        slug: 'aircon-services',
        icon: 'wind',
        description: 'Aircon cleaning and repair.',
        sortOrder: 30,
      },
    }),
  ]);

  const region = await prisma.location.create({
    data: { name: 'Test Region', locationType: 'REGION' },
  });
  const province = await prisma.location.create({
    data: { name: 'Test Province', locationType: 'PROVINCE', parentLocationId: region.id },
  });
  const cityA = await prisma.location.create({
    data: { name: 'Test City A', locationType: 'CITY', parentLocationId: province.id },
  });
  const cityB = await prisma.location.create({
    data: { name: 'Test City B', locationType: 'CITY', parentLocationId: province.id },
  });
  const barangayA = await prisma.location.create({
    data: { name: 'Test Barangay A', locationType: 'BARANGAY', parentLocationId: cityA.id },
  });
  const barangayB = await prisma.location.create({
    data: { name: 'Test Barangay B', locationType: 'BARANGAY', parentLocationId: cityB.id },
  });

  return { laptop, plumbing, aircon, region, province, cityA, cityB, barangayA, barangayB };
}

export async function createUser(options: {
  email: string;
  fullName?: string;
  role?: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  accountStatus?: 'ACTIVE' | 'SUSPENDED';
  verified?: boolean;
  password?: string;
  isDemo?: boolean;
  preferredLocationId?: string | null;
}) {
  const passwordHash = await bcrypt.hash(options.password ?? TEST_PASSWORD, 4);
  return prisma.user.create({
    data: {
      email: options.email,
      fullName: options.fullName ?? 'Test User',
      passwordHash,
      role: options.role ?? 'CUSTOMER',
      accountStatus: options.accountStatus ?? 'ACTIVE',
      emailVerifiedAt: options.verified === false ? null : new Date(),
      isDemo: options.isDemo ?? false,
      ...(options.role === 'ADMIN'
        ? {}
        : options.role === 'PROVIDER'
          ? {}
          : {
              customerProfile: {
                create: { preferredLocationId: options.preferredLocationId ?? null },
              },
            }),
    },
  });
}

export async function createProvider(options: {
  email: string;
  businessName: string;
  fullName?: string;
  categoryIds: string[];
  locationIds: string[];
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  startingPrice?: number;
  description?: string;
  identityVerified?: boolean;
  businessVerified?: boolean;
  isDemo?: boolean;
}) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      email: options.email,
      fullName: options.fullName ?? 'Provider Owner',
      passwordHash,
      role: 'PROVIDER',
      emailVerifiedAt: now,
      isDemo: options.isDemo ?? false,
      providerProfile: {
        create: {
          businessName: options.businessName,
          description: options.description ?? `${options.businessName} provides local services.`,
          approvalStatus: options.approvalStatus ?? 'APPROVED',
          approvedAt: (options.approvalStatus ?? 'APPROVED') === 'APPROVED' ? now : null,
          identityVerifiedAt: options.identityVerified ? now : null,
          businessVerifiedAt: options.businessVerified ? now : null,
          verificationStatus: options.businessVerified
            ? 'BUSINESS_VERIFIED'
            : options.identityVerified
              ? 'IDENTITY_VERIFIED'
              : 'UNVERIFIED',
          verificationRank: options.businessVerified ? 2 : options.identityVerified ? 1 : 0,
          isDemo: options.isDemo ?? false,
        },
      },
    },
    include: { providerProfile: true },
  });

  const provider = user.providerProfile!;

  for (const [index, categoryId] of options.categoryIds.entries()) {
    await prisma.serviceListing.create({
      data: {
        providerId: provider.id,
        categoryId,
        title: `${options.businessName} service ${index + 1}`,
        description: `Service offered by ${options.businessName}.`,
        startingPrice: (options.startingPrice ?? 50000) + index * 10000,
        priceType: 'STARTING_FROM',
        requiresInspection: true,
        isActive: true,
      },
    });
  }

  for (const locationId of options.locationIds) {
    await prisma.providerServiceArea.create({
      data: { providerId: provider.id, locationId },
    });
  }

  await recalcProviderStats(provider.id);
  const created = await prisma.providerProfile.findUniqueOrThrow({
    where: { id: provider.id },
    include: { user: true, listings: true, serviceAreas: true },
  });
  return { ...created, email: created.user.email };
}

export async function addReview(options: {
  providerId: string;
  customerId: string;
  rating: number;
  comment?: string;
  hidden?: boolean;
}) {
  const listing = await prisma.serviceListing.findFirst({
    where: { providerId: options.providerId, isActive: true },
    select: { categoryId: true },
  });
  const area = await prisma.providerServiceArea.findFirst({
    where: { providerId: options.providerId },
    select: { locationId: true },
  });
  if (!listing || !area) {
    throw new Error('Add a listing and service area before adding a review.');
  }

  const request = await prisma.serviceRequest.create({
    data: {
      customerId: options.customerId,
      categoryId: listing.categoryId,
      locationId: area.locationId,
      title: `Completed demo job ${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      problemDescription: 'A completed job used to verify review eligibility and rating calculations.',
      status: 'COMPLETED',
      assignedProviderId: options.providerId,
      completedAt: new Date(),
      quotes: {
        create: {
          providerId: options.providerId,
          proposedPrice: 75000,
          priceNotes: 'Test quote',
          status: 'ACCEPTED',
        },
      },
    },
  });

  const review = await prisma.review.create({
    data: {
      serviceRequestId: request.id,
      customerId: options.customerId,
      providerId: options.providerId,
      rating: options.rating,
      comment: options.comment ?? 'Completed on time and explained the repair clearly.',
      moderationStatus: options.hidden ? 'HIDDEN' : 'VISIBLE',
    },
  });
  await recalcProviderStats(options.providerId);
  return { review, request };
}

export async function createRequestRecord(options: {
  customerId: string;
  categoryId: string;
  locationId: string;
  status?: string;
  title?: string;
  targetProviderId?: string | null;
  assignedProviderId?: string | null;
}) {
  return prisma.serviceRequest.create({
    data: {
      customerId: options.customerId,
      categoryId: options.categoryId,
      locationId: options.locationId,
      title: options.title ?? 'Test service request',
      problemDescription: 'The test item is not working and needs a careful diagnosis before repair.',
      status: options.status ?? 'PENDING',
      targetProviderId: options.targetProviderId ?? null,
      assignedProviderId: options.assignedProviderId ?? null,
    },
  });
}

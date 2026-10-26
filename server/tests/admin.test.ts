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
let admin: Awaited<ReturnType<typeof createUser>>;
let customer: Awaited<ReturnType<typeof createUser>>;
let secondCustomer: Awaited<ReturnType<typeof createUser>>;
let approvedProvider: Awaited<ReturnType<typeof createProvider>>;
let pendingProvider: Awaited<ReturnType<typeof createProvider>>;

beforeEach(async () => {
  await resetDatabase();
  catalog = await createCatalog();
  admin = await createUser({ email: 'admin@example.test', fullName: 'Admin User', role: 'ADMIN' });
  customer = await createUser({ email: 'customer@example.test', fullName: 'Customer One' });
  secondCustomer = await createUser({ email: 'customer2@example.test', fullName: 'Customer Two' });
  approvedProvider = await createProvider({
    email: 'approved.provider@example.test',
    businessName: 'Approved Plumbing',
    categoryIds: [catalog.plumbing.id],
    locationIds: [catalog.cityA.id],
  });
  pendingProvider = await createProvider({
    email: 'pending.provider@example.test',
    businessName: 'Pending Laptop Care',
    categoryIds: [catalog.laptop.id],
    locationIds: [catalog.barangayA.id],
    approvalStatus: 'PENDING',
  });
});

async function auditActions(): Promise<string[]> {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } });
  return logs.map((log) => log.action);
}

describe('admin authorization and user management', () => {
  it('protects every admin endpoint with a server-side role check', async () => {
    const anonymous = await createClient();
    await anonymous.get('/api/admin/dashboard').expect(401);

    const customerClient = await clientFor(customer.email);
    await customerClient.get('/api/admin/dashboard').expect(403);
    await customerClient.get('/api/admin/users').expect(403);

    const providerClient = await clientFor(approvedProvider.user.email);
    await providerClient.get('/api/admin/providers').expect(403);

    const adminClient = await clientFor(admin.email);
    const dashboard = await adminClient.get('/api/admin/dashboard').expect(200);
    expect(dashboard.body.data.counts.pendingProviders).toBe(1);
    expect(dashboard.body.data.counts.providers).toBe(2);
    expect(dashboard.body.data.counts.users).toBe(5);
    expect(dashboard.body.data.requestsByStatus).toHaveProperty('COMPLETED', 0);
  });

  it('lists and filters users, and requires a reason to suspend', async () => {
    const adminClient = await clientFor(admin.email);

    const list = await adminClient.get('/api/admin/users?pageSize=10').expect(200);
    expect(list.body.meta.total).toBe(5);

    const providers = await adminClient.get('/api/admin/users?role=PROVIDER').expect(200);
    expect(providers.body.data.every((user: { role: string }) => user.role === 'PROVIDER')).toBe(true);

    const search = await adminClient.get('/api/admin/users?q=customer2').expect(200);
    expect(search.body.data).toHaveLength(1);
    expect(search.body.data[0].email).toBe('customer2@example.test');

    await adminClient.get('/api/admin/users?role=OWNER').expect(422);

    const noReason = await adminClient
      .patch(`/api/admin/users/${customer.id}/status`, { accountStatus: 'SUSPENDED' })
      .expect(422);
    expect(noReason.body.error.code).toBe('VALIDATION_ERROR');

    const customerClient = await clientFor(customer.email);
    expect(await prisma.session.count({ where: { userId: customer.id } })).toBe(1);

    const suspended = await adminClient
      .patch(`/api/admin/users/${customer.id}/status`, {
        accountStatus: 'SUSPENDED',
        reason: 'Repeated abusive reports confirmed by moderation.',
      })
      .expect(200);
    expect(suspended.body.data.accountStatus).toBe('SUSPENDED');
    expect(await prisma.session.count({ where: { userId: customer.id } })).toBe(0);

    const staleSession = await customerClient.get('/api/auth/me').expect(200);
    expect(staleSession.body.data.user).toBeNull();
    await customerClient
      .post('/api/auth/login', { email: customer.email, password: 'TestPassword123' })
      .expect(403);

    await adminClient
      .patch(`/api/admin/users/${customer.id}/status`, { accountStatus: 'ACTIVE' })
      .expect(200);
    await customerClient
      .post('/api/auth/login', { email: customer.email, password: 'TestPassword123' })
      .expect(200);

    const self = await adminClient
      .patch(`/api/admin/users/${admin.id}/status`, {
        accountStatus: 'SUSPENDED',
        reason: 'Trying to suspend myself',
      })
      .expect(400);
    expect(self.body.error.code).toBe('CANNOT_MODIFY_SELF');

    const otherAdmin = await createUser({ email: 'admin2@example.test', role: 'ADMIN' });
    const protectedAdmin = await adminClient
      .patch(`/api/admin/users/${otherAdmin.id}/status`, {
        accountStatus: 'SUSPENDED',
        reason: 'Trying to suspend another admin',
      })
      .expect(403);
    expect(protectedAdmin.body.error.code).toBe('ADMIN_PROTECTED');

    expect(await auditActions()).toContain('user.status_changed');
  });

  it('grants admin only to verified customer accounts and audits the action', async () => {
    const adminClient = await clientFor(admin.email);
    const unverified = await createUser({ email: 'unverified@example.test', verified: false });
    const target = await createUser({ email: 'promote@example.test', fullName: 'Promote Me' });
    await clientFor(target.email);

    await adminClient
      .post(`/api/admin/users/${unverified.id}/grant-admin`, { role: 'ADMIN' })
      .expect(409);
    await adminClient
      .post(`/api/admin/users/${approvedProvider.userId}/grant-admin`, { role: 'ADMIN' })
      .expect(409);

    const promoted = await adminClient
      .post(`/api/admin/users/${target.id}/grant-admin`, { role: 'ADMIN' })
      .expect(200);
    expect(promoted.body.data.role).toBe('ADMIN');
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);

    const promotedClient = await clientFor(target.email);
    await promotedClient.get('/api/admin/dashboard').expect(200);

    await adminClient
      .post(`/api/admin/users/${target.id}/grant-admin`, { role: 'ADMIN' })
      .expect(409);

    expect(await auditActions()).toContain('user.admin_granted');
    const audit = await adminClient.get('/api/admin/audit-logs?q=admin_granted').expect(200);
    expect(audit.body.meta.total).toBe(1);
    expect(audit.body.data[0].actor.email).toBe(admin.email);
  });
});

describe('provider approval and verification', () => {
  it('approves or rejects provider applications with an audit trail', async () => {
    const adminClient = await clientFor(admin.email);
    const publicClient = await clientFor(customer.email);

    const before = await publicClient.get('/api/providers?q=Pending').expect(200);
    expect(before.body.meta.total).toBe(0);

    const queue = await adminClient.get('/api/admin/providers?status=PENDING').expect(200);
    expect(queue.body.data.map((provider: { id: string }) => provider.id)).toContain(pendingProvider.id);

    await adminClient
      .patch(`/api/admin/providers/${pendingProvider.id}/approval`, { approvalStatus: 'REJECTED' })
      .expect(422);
    const rejected = await adminClient
      .patch(`/api/admin/providers/${pendingProvider.id}/approval`, {
        approvalStatus: 'REJECTED',
        reason: 'The business name and service area need clarification.',
      })
      .expect(200);
    expect(rejected.body.data.approvalStatus).toBe('REJECTED');
    expect(rejected.body.data.rejectionReason).toContain('clarification');

    const approved = await adminClient
      .patch(`/api/admin/providers/${pendingProvider.id}/approval`, { approvalStatus: 'APPROVED' })
      .expect(200);
    expect(approved.body.data.approvalStatus).toBe('APPROVED');
    expect(approved.body.data.rejectionReason).toBeNull();

    const after = await publicClient.get('/api/providers?q=Pending').expect(200);
    expect(after.body.meta.total).toBe(1);

    const actions = await auditActions();
    expect(actions).toContain('provider.rejected');
    expect(actions).toContain('provider.approved');
  });

  it('updates badges only after an admin reviews a verification request', async () => {
    const providerClient = await clientFor(approvedProvider.user.email);
    const adminClient = await clientFor(admin.email);
    const publicClient = await clientFor(customer.email);

    const request = await providerClient
      .post('/api/providers/me/verifications', {
        verificationType: 'IDENTITY',
        note: 'I can present a government-issued ID and a barangay certificate in person.',
      })
      .expect(201);

    await providerClient
      .post('/api/providers/me/verifications', {
        verificationType: 'IDENTITY',
        note: 'Another duplicate request that should not be accepted.',
      })
      .expect(409);

    const before = await publicClient.get(`/api/providers/${approvedProvider.id}`).expect(200);
    expect(before.body.data.identityVerified).toBe(false);
    expect(before.body.data.verificationStatus).toBe('UNVERIFIED');

    const queue = await adminClient
      .get('/api/admin/verifications?status=PENDING')
      .expect(200);
    expect(queue.body.data).toHaveLength(1);
    expect(queue.body.data[0].id).toBe(request.body.data.id);

    await adminClient
      .patch(`/api/admin/verifications/${request.body.data.id}`, { status: 'REJECTED' })
      .expect(422);

    const approved = await adminClient
      .patch(`/api/admin/verifications/${request.body.data.id}`, {
        status: 'APPROVED',
        reviewNote: 'ID checked in person by the moderator on duty.',
      })
      .expect(200);
    expect(approved.body.data.status).toBe('APPROVED');

    await adminClient
      .patch(`/api/admin/verifications/${request.body.data.id}`, { status: 'APPROVED' })
      .expect(409);

    const profile = await providerClient.get('/api/providers/me').expect(200);
    expect(profile.body.data.identityVerified).toBe(true);
    expect(profile.body.data.verificationStatus).toBe('IDENTITY_VERIFIED');

    const after = await publicClient.get(`/api/providers/${approvedProvider.id}`).expect(200);
    expect(after.body.data.identityVerified).toBe(true);

    await providerClient
      .post('/api/providers/me/verifications', {
        verificationType: 'IDENTITY',
        note: 'Trying to verify the same identity badge again after approval.',
      })
      .expect(409);

    expect(await auditActions()).toContain('verification.approved');
  });

  it('does not badge an unapproved provider and enforces provider-side eligibility', async () => {
    const pendingClient = await clientFor(pendingProvider.user.email);
    await pendingClient
      .post('/api/providers/me/verifications', {
        verificationType: 'IDENTITY',
        note: 'I would like to submit a government ID before my profile is approved.',
      })
      .expect(409);

    const verification = await prisma.providerVerification.create({
      data: {
        providerId: pendingProvider.id,
        verificationType: 'IDENTITY',
        note: 'A direct test record for an unapproved provider.',
      },
    });

    const adminClient = await clientFor(admin.email);
    const response = await adminClient
      .patch(`/api/admin/verifications/${verification.id}`, { status: 'APPROVED' })
      .expect(409);
    expect(response.body.error.code).toBe('PROVIDER_NOT_APPROVED');

    const profile = await prisma.providerProfile.findUniqueOrThrow({ where: { id: pendingProvider.id } });
    expect(profile.identityVerifiedAt).toBeNull();
  });
});

describe('review moderation and reports', () => {
  it('moderates reviews with rating recalculation and an audit trail', async () => {
    const { review } = await addReview({
      providerId: approvedProvider.id,
      customerId: customer.id,
      rating: 5,
      comment: 'Excellent and honest service.',
    });
    const adminClient = await clientFor(admin.email);
    const publicClient = await clientFor(secondCustomer.email);

    const list = await adminClient.get('/api/admin/reviews?moderationStatus=VISIBLE').expect(200);
    expect(list.body.data).toHaveLength(1);

    await adminClient
      .patch(`/api/admin/reviews/${review.id}/moderation`, { moderationStatus: 'HIDDEN' })
      .expect(422);

    const hidden = await adminClient
      .patch(`/api/admin/reviews/${review.id}/moderation`, {
        moderationStatus: 'HIDDEN',
        reason: 'Contains personal contact details in the public comment.',
      })
      .expect(200);
    expect(hidden.body.data.moderationStatus).toBe('HIDDEN');

    const profile = await prisma.providerProfile.findUniqueOrThrow({ where: { id: approvedProvider.id } });
    expect(profile.reviewCount).toBe(0);
    expect(profile.ratingAvg).toBe(0);

    const publicProfile = await publicClient.get(`/api/providers/${approvedProvider.id}`).expect(200);
    expect(publicProfile.body.data.recentReviews).toHaveLength(0);
    expect(publicProfile.body.data.reviewCount).toBe(0);

    const providerClient = await clientFor(approvedProvider.user.email);
    await providerClient
      .patch(`/api/providers/me/reviews/${review.id}/response`, {
        response: 'This review is hidden and cannot be answered.',
      })
      .expect(404);

    const visible = await adminClient
      .patch(`/api/admin/reviews/${review.id}/moderation`, { moderationStatus: 'VISIBLE' })
      .expect(200);
    expect(visible.body.data.moderationStatus).toBe('VISIBLE');
    expect(await auditActions()).toContain('review.moderated');
  });

  it('accepts reports from eligible reporters and resolves them once', async () => {
    const { review } = await addReview({
      providerId: approvedProvider.id,
      customerId: customer.id,
      rating: 2,
      comment: 'A review that another customer will report for testing.',
    });
    const reporter = await clientFor(secondCustomer.email);
    const author = await clientFor(customer.email);
    const providerClient = await clientFor(approvedProvider.user.email);

    const ownReview = await author
      .post(`/api/reviews/${review.id}/report`, {
        reason: 'OTHER',
        description: 'Trying to report my own review should fail.',
      })
      .expect(400);
    expect(ownReview.body.error.code).toBe('CANNOT_REPORT_SELF');

    const report = await reporter
      .post(`/api/reviews/${review.id}/report`, {
        reason: 'ABUSIVE_CONTENT',
        description: 'The comment includes language that should be reviewed by a moderator.',
      })
      .expect(201);

    await reporter
      .post(`/api/reviews/${review.id}/report`, {
        reason: 'SPAM',
        description: 'A duplicate open report for the same review should be rejected.',
      })
      .expect(409);

    await providerClient
      .post(`/api/reviews/${review.id}/report`, {
        reason: 'MISLEADING_INFO',
        description: 'The provider wants a moderator to check this review.',
      })
      .expect(201);

    await reporter
      .post('/api/reports', {
        entityType: 'PROVIDER',
        entityId: approvedProvider.id,
        reason: 'MISLEADING_INFO',
        description: 'The listed price and description may not match the service.',
      })
      .expect(201);

    await providerClient
      .post('/api/reports', {
        entityType: 'PROVIDER',
        entityId: approvedProvider.id,
        reason: 'OTHER',
        description: 'A provider cannot report its own profile.',
      })
      .expect(400);

    await reporter
      .post('/api/reports', {
        entityType: 'REVIEW',
        entityId: 'missing-review',
        reason: 'SPAM',
        description: 'This review identifier does not exist.',
      })
      .expect(404);

    const adminClient = await clientFor(admin.email);
    const open = await adminClient.get('/api/admin/reports?status=OPEN').expect(200);
    expect(open.body.meta.total).toBe(3);
    expect(open.body.data.every((row: { targetPreview: unknown }) => row.targetPreview !== null)).toBe(true);

    const resolved = await adminClient
      .patch(`/api/admin/reports/${report.body.data.id}`, {
        status: 'RESOLVED',
        resolutionNote: 'Moderator reviewed the review and contacted the reporter.',
      })
      .expect(200);
    expect(resolved.body.data.status).toBe('RESOLVED');
    expect(resolved.body.data.reviewedBy.fullName).toBe(admin.fullName);

    await adminClient
      .patch(`/api/admin/reports/${report.body.data.id}`, {
        status: 'DISMISSED',
        resolutionNote: 'Trying to close an already resolved report.',
      })
      .expect(409);

    expect(await auditActions()).toContain('report.resolved');
  });
});

describe('category and location administration', () => {
  it('creates and deactivates categories, and removes them from public discovery', async () => {
    const adminClient = await clientFor(admin.email);
    const customerClient = await clientFor(customer.email);

    await customerClient
      .post('/api/admin/categories', { name: 'Unauthorized Category', icon: 'wrench' })
      .expect(403);

    const created = await adminClient
      .post('/api/admin/categories', {
        name: 'Mobile Phone Repair',
        icon: 'smartphone',
        description: 'Screen and battery repair.',
        sortOrder: 90,
        isActive: true,
      })
      .expect(201);
    expect(created.body.data.slug).toBe('mobile-phone-repair');

    const duplicateName = await adminClient
      .post('/api/admin/categories', {
        name: 'Mobile Phone Repair',
        icon: 'smartphone',
        sortOrder: 95,
        isActive: true,
      })
      .expect(201);
    expect(duplicateName.body.data.slug).not.toBe(created.body.data.slug);

    await adminClient
      .post('/api/admin/categories', { icon: 'wrench' })
      .expect(422);

    await adminClient
      .patch(`/api/admin/categories/${catalog.plumbing.id}`, { isActive: false })
      .expect(200);

    const publicCategories = await customerClient.get('/api/categories').expect(200);
    expect(publicCategories.body.data.map((category: { slug: string }) => category.slug)).not.toContain(
      'plumbing-services',
    );

    const adminCategories = await adminClient.get('/api/admin/categories').expect(200);
    expect(adminCategories.body.data.map((category: { id: string }) => category.id)).toContain(
      catalog.plumbing.id,
    );

    const publicProviders = await customerClient.get('/api/providers').expect(200);
    expect(publicProviders.body.data.map((provider: { id: string }) => provider.id)).not.toContain(
      approvedProvider.id,
    );

    const actions = await auditActions();
    expect(actions).toContain('category.created');
    expect(actions).toContain('category.updated');
  });

  it('validates location hierarchy and cascades deactivation to children', async () => {
    const adminClient = await clientFor(admin.email);
    const publicClient = await clientFor(customer.email);

    const city = await adminClient
      .post('/api/admin/locations', {
        name: 'Admin Test City',
        locationType: 'CITY',
        parentId: catalog.province.id,
        isActive: true,
      })
      .expect(201);

    const barangay = await adminClient
      .post('/api/admin/locations', {
        name: 'Admin Test Barangay',
        locationType: 'BARANGAY',
        parentId: city.body.data.id,
        isActive: true,
      })
      .expect(201);

    await adminClient
      .post('/api/admin/locations', {
        name: 'Invalid Child City',
        locationType: 'CITY',
        parentId: barangay.body.data.id,
        isActive: true,
      })
      .expect(400);

    await adminClient
      .post('/api/admin/locations', {
        name: 'Province Without Parent',
        locationType: 'PROVINCE',
        isActive: true,
      })
      .expect(400);

    await adminClient
      .patch(`/api/admin/locations/${city.body.data.id}`, {
        parentId: barangay.body.data.id,
      })
      .expect(400);

    const providerInNewCity = await createProvider({
      email: 'newcity.provider@example.test',
      businessName: 'New City Aircon',
      categoryIds: [catalog.aircon.id],
      locationIds: [city.body.data.id],
    });

    const before = await publicClient.get('/api/providers').expect(200);
    expect(before.body.data.map((provider: { id: string }) => provider.id)).toContain(providerInNewCity.id);

    await adminClient
      .patch(`/api/admin/locations/${city.body.data.id}`, { isActive: false })
      .expect(200);

    const child = await prisma.location.findUniqueOrThrow({ where: { id: barangay.body.data.id } });
    expect(child.isActive).toBe(false);

    const catalogs = await publicClient.get('/api/locations').expect(200);
    const locationIds = catalogs.body.data.map((location: { id: string }) => location.id);
    expect(locationIds).not.toContain(city.body.data.id);
    expect(locationIds).not.toContain(barangay.body.data.id);

    const after = await publicClient.get('/api/providers').expect(200);
    expect(after.body.data.map((provider: { id: string }) => provider.id)).not.toContain(
      providerInNewCity.id,
    );

    await adminClient
      .patch(`/api/admin/locations/${barangay.body.data.id}`, { isActive: true })
      .expect(400);

    expect(await auditActions()).toContain('location.created');
    expect(await auditActions()).toContain('location.updated');
  });
});

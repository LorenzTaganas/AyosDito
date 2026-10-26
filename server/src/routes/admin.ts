import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  ACCOUNT_STATUSES,
  PROVIDER_APPROVAL_STATUSES,
  REPORT_STATUSES,
  REQUEST_STATUSES,
  REVIEW_MODERATION_STATUSES,
  ROLES,
  VERIFICATION_REVIEW_STATUSES,
  categoryInputSchema,
  categoryPatchSchema,
  grantAdminSchema,
  locationInputSchema,
  locationPatchSchema,
  paginationQuerySchema,
  providerApprovalSchema,
  reportUpdateSchema,
  reviewModerationSchema,
  slugify,
  userStatusSchema,
  verificationReviewSchema,
} from '../../../shared/contracts';
import type { RequestStatus } from '../../../shared/contracts';
import type {
  AdminCategoryDto,
  AdminDashboardDto,
  AdminLocationDto,
  AdminReportDto,
  AdminReviewDto,
  AdminUserDto,
  AdminVerificationDto,
  AuditLogDto,
  ReportTargetPreview,
} from '../../../shared/api-types';
import { ApiError, asyncHandler, notFound, parseBody, parseId, parseQuery } from '../lib/http';
import { writeAudit } from '../lib/audit';
import { parseAuditMetadata, providerCardInclude, toAdminProvider } from '../lib/serialize';
import { currentUser, requireAuth, requireRole } from '../middleware/session';
import { writeLimiter } from '../middleware/rateLimit';
import { prisma } from '../prisma';
import { recalcProviderStats, verificationRank, verificationStatusFor } from '../services/providerStats';
import { childTypeAllowed } from '../services/locations';
import { buildPageMeta } from './providers';

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireRole('ADMIN'));
adminRouter.use(writeLimiter);

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

const reportInclude = {
  reporter: { select: { id: true, fullName: true, email: true } },
  reviewedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ReportInclude;

type ReportRow = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

const adminReviewInclude = {
  customer: { select: { id: true, fullName: true, email: true, isDemo: true } },
  provider: { select: { id: true, businessName: true } },
} satisfies Prisma.ReviewInclude;

type AdminReviewRow = Prisma.ReviewGetPayload<{ include: typeof adminReviewInclude }>;

const verificationInclude = {
  provider: { select: { id: true, businessName: true, approvalStatus: true } },
  reviewedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ProviderVerificationInclude;

type VerificationRow = Prisma.ProviderVerificationGetPayload<{ include: typeof verificationInclude }>;

const auditInclude = {
  actor: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.AuditLogInclude;

type AuditRow = Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>;

const adminUserInclude = {
  providerProfile: {
    select: { id: true, businessName: true, approvalStatus: true, verificationStatus: true },
  },
} satisfies Prisma.UserInclude;

type AdminUserRow = Prisma.UserGetPayload<{ include: typeof adminUserInclude }>;

const categoryInclude = {
  _count: { select: { listings: true, requests: true } },
} satisfies Prisma.CategoryInclude;

type CategoryRow = Prisma.CategoryGetPayload<{ include: typeof categoryInclude }>;

const locationInclude = {
  parent: { select: { id: true, name: true } },
  _count: { select: { children: true, serviceAreas: true, requests: true } },
} satisfies Prisma.LocationInclude;

type LocationRow = Prisma.LocationGetPayload<{ include: typeof locationInclude }>;

function toAdminUser(user: AdminUserRow): AdminUserDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as AdminUserDto['role'],
    accountStatus: user.accountStatus as AdminUserDto['accountStatus'],
    emailVerified: Boolean(user.emailVerifiedAt),
    isDemo: user.isDemo,
    createdAt: user.createdAt.toISOString(),
    provider: user.providerProfile
      ? {
          id: user.providerProfile.id,
          businessName: user.providerProfile.businessName,
          approvalStatus: user.providerProfile
            .approvalStatus as NonNullable<AdminUserDto['provider']>['approvalStatus'],
          verificationStatus: user.providerProfile
            .verificationStatus as NonNullable<AdminUserDto['provider']>['verificationStatus'],
        }
      : null,
  };
}

function toAdminVerification(row: VerificationRow): AdminVerificationDto {
  return {
    id: row.id,
    verificationType: row.verificationType as AdminVerificationDto['verificationType'],
    status: row.status as AdminVerificationDto['status'],
    note: row.note,
    reviewNote: row.reviewNote,
    reviewedByName: row.reviewedBy?.fullName ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    provider: {
      id: row.provider.id,
      businessName: row.provider.businessName,
      approvalStatus: row.provider.approvalStatus as AdminVerificationDto['provider']['approvalStatus'],
    },
  };
}

function toAdminReview(row: AdminReviewRow): AdminReviewDto {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    moderationStatus: row.moderationStatus as AdminReviewDto['moderationStatus'],
    providerResponse: row.providerResponse,
    author: {
      id: row.customer.id,
      displayName: row.customer.fullName,
      email: row.customer.email,
      isDemo: row.customer.isDemo,
    },
    provider: { id: row.provider.id, businessName: row.provider.businessName },
  };
}

function toAuditLog(row: AuditRow): AuditLogDto {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: parseAuditMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
    actor: row.actor ? { id: row.actor.id, fullName: row.actor.fullName, email: row.actor.email } : null,
  };
}

function toAdminCategory(row: CategoryRow): AdminCategoryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    listingCount: row._count.listings,
    requestCount: row._count.requests,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAdminLocation(row: LocationRow): AdminLocationDto {
  return {
    id: row.id,
    name: row.name,
    locationType: row.locationType as AdminLocationDto['locationType'],
    parentId: row.parentLocationId,
    parentName: row.parent?.name ?? null,
    isActive: row.isActive,
    childCount: row._count.children,
    serviceAreaCount: row._count.serviceAreas,
    requestCount: row._count.requests,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function buildReportDtos(rows: ReportRow[]): Promise<AdminReportDto[]> {
  const providerIds = rows.filter((row) => row.reportedEntityType === 'PROVIDER').map((row) => row.reportedEntityId);
  const reviewIds = rows.filter((row) => row.reportedEntityType === 'REVIEW').map((row) => row.reportedEntityId);

  const [providers, reviews] = await Promise.all([
    providerIds.length
      ? prisma.providerProfile.findMany({
          where: { id: { in: providerIds } },
          select: { id: true, businessName: true, approvalStatus: true, verificationStatus: true },
        })
      : Promise.resolve([]),
    reviewIds.length
      ? prisma.review.findMany({
          where: { id: { in: reviewIds } },
          select: {
            id: true,
            rating: true,
            comment: true,
            moderationStatus: true,
            customer: { select: { fullName: true } },
            provider: { select: { businessName: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
  const reviewMap = new Map(reviews.map((review) => [review.id, review]));

  return rows.map((row) => {
    let preview: ReportTargetPreview | null = null;
    if (row.reportedEntityType === 'PROVIDER') {
      const provider = providerMap.get(row.reportedEntityId);
      if (provider) {
        preview = {
          label: provider.businessName,
          detail: `Application: ${provider.approvalStatus.toLowerCase()} · ${provider.verificationStatus.replaceAll('_', ' ').toLowerCase()}`,
        };
      }
    } else {
      const review = reviewMap.get(row.reportedEntityId);
      if (review) {
        preview = {
          label: `${review.rating}-star review for ${review.provider.businessName}`,
          detail: review.comment
            ? `${review.comment.slice(0, 160)}${review.comment.length > 160 ? '…' : ''}`
            : `Written by ${review.customer.fullName} · no comment · ${review.moderationStatus.toLowerCase()}`,
        };
      }
    }

    return {
      id: row.id,
      entityType: row.reportedEntityType as AdminReportDto['entityType'],
      entityId: row.reportedEntityId,
      reason: row.reason as AdminReportDto['reason'],
      description: row.description,
      status: row.status as AdminReportDto['status'],
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      reporter: row.reporter,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      targetPreview: preview,
    };
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

adminRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const [
      users,
      customers,
      providers,
      admins,
      suspendedUsers,
      pendingProvidersCount,
      approvedProviders,
      openRequests,
      activeJobs,
      completedRequests,
      visibleReviews,
      openReports,
      statusGroups,
      pendingProviders,
      latestReports,
      recentAudit,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'PROVIDER' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { accountStatus: 'SUSPENDED' } }),
      prisma.providerProfile.count({ where: { approvalStatus: 'PENDING' } }),
      prisma.providerProfile.count({ where: { approvalStatus: 'APPROVED' } }),
      prisma.serviceRequest.count({ where: { status: { in: ['PENDING', 'RESPONDED'] } } }),
      prisma.serviceRequest.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.serviceRequest.count({ where: { status: 'COMPLETED' } }),
      prisma.review.count({ where: { moderationStatus: 'VISIBLE' } }),
      prisma.report.count({ where: { status: 'OPEN' } }),
      prisma.serviceRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.providerProfile.findMany({
        where: { approvalStatus: 'PENDING' },
        include: providerCardInclude,
        orderBy: { createdAt: 'asc' },
        take: 5,
      }),
      prisma.report.findMany({
        where: { status: 'OPEN' },
        include: reportInclude,
        orderBy: { createdAt: 'asc' },
        take: 5,
      }),
      prisma.auditLog.findMany({
        include: auditInclude,
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const requestsByStatus = Object.fromEntries(REQUEST_STATUSES.map((status) => [status, 0])) as Record<
      RequestStatus,
      number
    >;
    for (const group of statusGroups) {
      if (group.status in requestsByStatus) {
        requestsByStatus[group.status as RequestStatus] = group._count._all;
      }
    }

    const data: AdminDashboardDto = {
      counts: {
        users,
        customers,
        providers,
        admins,
        suspendedUsers,
        pendingProviders: pendingProvidersCount,
        approvedProviders,
        openRequests,
        activeJobs,
        completedRequests,
        visibleReviews,
        openReports,
      },
      requestsByStatus,
      pendingProviders: pendingProviders.map(toAdminProvider),
      openReports: await buildReportDtos(latestReports),
      recentAudit: recentAudit.map(toAuditLog),
    };

    res.json({ data });
  }),
);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const userListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
  role: z.enum(ROLES).optional(),
});

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const query = parseQuery(userListQuerySchema, req.query);
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { accountStatus: query.status } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.q
        ? {
            OR: [
              { fullName: { contains: query.q } },
              { email: { contains: query.q } },
              { providerProfile: { is: { businessName: { contains: query.q } } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        include: adminUserInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    res.json({ data: rows.map(toAdminUser), meta: buildPageMeta(total, query.page, query.pageSize) });
  }),
);

adminRouter.patch(
  '/users/:id/status',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const userId = parseId(req.params.id, 'user');
    const input = parseBody(userStatusSchema, req.body);

    if (userId === admin.id) {
      throw new ApiError(400, 'CANNOT_MODIFY_SELF', 'You cannot change your own account status.');
    }
    const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!target) throw notFound('User not found.');
    if (target.role === 'ADMIN') {
      throw new ApiError(403, 'ADMIN_PROTECTED', 'Administrator accounts cannot be suspended from this screen.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { accountStatus: input.accountStatus },
      });
      if (input.accountStatus === 'SUSPENDED') {
        await tx.session.deleteMany({ where: { userId } });
      }
      await writeAudit(tx, admin.id, 'user.status_changed', 'USER', userId, {
        accountStatus: input.accountStatus,
        reason: input.reason ?? null,
      });
    });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: adminUserInclude });
    res.json({ data: toAdminUser(row) });
  }),
);

adminRouter.post(
  '/users/:id/grant-admin',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const userId = parseId(req.params.id, 'user');
    parseBody(grantAdminSchema, req.body);

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, accountStatus: true, emailVerifiedAt: true },
    });
    if (!target) throw notFound('User not found.');
    if (target.role === 'ADMIN') {
      throw new ApiError(409, 'ALREADY_ADMIN', 'This account is already an administrator.');
    }
    if (target.role !== 'CUSTOMER') {
      throw new ApiError(409, 'ROLE_NOT_ELIGIBLE', 'Only customer accounts can be promoted to administrator.');
    }
    if (target.accountStatus !== 'ACTIVE') {
      throw new ApiError(409, 'ACCOUNT_INACTIVE', 'Reactivate the account before granting administrator access.');
    }
    if (!target.emailVerifiedAt) {
      throw new ApiError(409, 'EMAIL_NOT_VERIFIED', 'The account must verify its email before becoming an administrator.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
      await tx.session.deleteMany({ where: { userId } });
      await writeAudit(tx, admin.id, 'user.admin_granted', 'USER', userId, {
        previousRole: target.role,
      });
    });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: adminUserInclude });
    res.json({ data: toAdminUser(row) });
  }),
);

// ---------------------------------------------------------------------------
// Providers and verification
// ---------------------------------------------------------------------------

const providerListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  status: z.enum(PROVIDER_APPROVAL_STATUSES).optional(),
});

adminRouter.get(
  '/providers',
  asyncHandler(async (req, res) => {
    const query = parseQuery(providerListQuerySchema, req.query);
    const where: Prisma.ProviderProfileWhereInput = {
      ...(query.status ? { approvalStatus: query.status } : {}),
      ...(query.q
        ? {
            OR: [
              { businessName: { contains: query.q } },
              { description: { contains: query.q } },
              { user: { is: { email: { contains: query.q } } } },
              { user: { is: { fullName: { contains: query.q } } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.providerProfile.count({ where }),
      prisma.providerProfile.findMany({
        where,
        include: providerCardInclude,
        orderBy: [{ approvalStatus: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    res.json({ data: rows.map(toAdminProvider), meta: buildPageMeta(total, query.page, query.pageSize) });
  }),
);

adminRouter.patch(
  '/providers/:id/approval',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const providerId = parseId(req.params.id, 'provider');
    const input = parseBody(providerApprovalSchema, req.body);

    const provider = await prisma.providerProfile.findUnique({
      where: { id: providerId },
      select: { id: true, approvalStatus: true, businessName: true, user: { select: { role: true } } },
    });
    if (!provider) throw notFound('Provider not found.');
    if (provider.user.role !== 'PROVIDER') {
      throw new ApiError(409, 'NOT_A_PROVIDER', 'This account is not a provider account.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.providerProfile.update({
        where: { id: providerId },
        data:
          input.approvalStatus === 'APPROVED'
            ? { approvalStatus: 'APPROVED', approvedAt: new Date(), rejectionReason: null }
            : { approvalStatus: 'REJECTED', approvedAt: null, rejectionReason: input.reason ?? null },
      });
      await writeAudit(
        tx,
        admin.id,
        input.approvalStatus === 'APPROVED' ? 'provider.approved' : 'provider.rejected',
        'PROVIDER',
        providerId,
        { businessName: provider.businessName, reason: input.reason ?? null, previousStatus: provider.approvalStatus },
      );
    });

    const row = await prisma.providerProfile.findUniqueOrThrow({
      where: { id: providerId },
      include: providerCardInclude,
    });
    res.json({ data: toAdminProvider(row) });
  }),
);

const verificationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(VERIFICATION_REVIEW_STATUSES).optional(),
});

adminRouter.get(
  '/verifications',
  asyncHandler(async (req, res) => {
    const query = parseQuery(verificationListQuerySchema, req.query);
    const where: Prisma.ProviderVerificationWhereInput = query.status ? { status: query.status } : {};

    const [total, rows] = await Promise.all([
      prisma.providerVerification.count({ where }),
      prisma.providerVerification.findMany({
        where,
        include: verificationInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    res.json({ data: rows.map(toAdminVerification), meta: buildPageMeta(total, query.page, query.pageSize) });
  }),
);

adminRouter.patch(
  '/verifications/:id',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const verificationId = parseId(req.params.id, 'verification');
    const input = parseBody(verificationReviewSchema, req.body);

    const verification = await prisma.providerVerification.findUnique({
      where: { id: verificationId },
      include: { provider: { select: { id: true, approvalStatus: true, identityVerifiedAt: true, businessVerifiedAt: true } } },
    });
    if (!verification) throw notFound('Verification request not found.');
    if (verification.status !== 'PENDING') {
      throw new ApiError(409, 'VERIFICATION_CLOSED', 'This verification request was already reviewed.');
    }
    if (input.status === 'APPROVED' && verification.provider.approvalStatus !== 'APPROVED') {
      throw new ApiError(
        409,
        'PROVIDER_NOT_APPROVED',
        'Approve the provider application before granting a verification badge.',
      );
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const updated = await tx.providerVerification.updateMany({
        where: { id: verificationId, status: 'PENDING' },
        data: {
          status: input.status,
          reviewNote: input.reviewNote ?? null,
          reviewedById: admin.id,
          reviewedAt: now,
        },
      });
      if (updated.count === 0) {
        throw new ApiError(409, 'VERIFICATION_CLOSED', 'This verification request was already reviewed.');
      }

      if (input.status === 'APPROVED') {
        const identityVerifiedAt =
          verification.verificationType === 'IDENTITY' ? now : verification.provider.identityVerifiedAt;
        const businessVerifiedAt =
          verification.verificationType === 'BUSINESS' ? now : verification.provider.businessVerifiedAt;
        await tx.providerProfile.update({
          where: { id: verification.provider.id },
          data: {
            identityVerifiedAt,
            businessVerifiedAt,
            verificationStatus: verificationStatusFor(Boolean(identityVerifiedAt), Boolean(businessVerifiedAt)),
            verificationRank: verificationRank(Boolean(identityVerifiedAt), Boolean(businessVerifiedAt)),
          },
        });
      }

      await writeAudit(
        tx,
        admin.id,
        input.status === 'APPROVED' ? 'verification.approved' : 'verification.rejected',
        'PROVIDER_VERIFICATION',
        verificationId,
        {
          providerId: verification.provider.id,
          verificationType: verification.verificationType,
          reviewNote: input.reviewNote ?? null,
        },
      );
    });

    const row = await prisma.providerVerification.findUniqueOrThrow({
      where: { id: verificationId },
      include: verificationInclude,
    });
    res.json({ data: toAdminVerification(row) });
  }),
);

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

async function uniqueCategorySlug(name: string): Promise<string> {
  const base = slugify(name) || 'category';
  let slug = base.slice(0, 60);
  let counter = 2;
  while (await prisma.category.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base.slice(0, 55)}-${counter}`;
    counter += 1;
  }
  return slug;
}

adminRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.category.findMany({
      include: categoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ data: rows.map(toAdminCategory) });
  }),
);

adminRouter.post(
  '/categories',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const input = parseBody(categoryInputSchema, req.body);
    const slug = await uniqueCategorySlug(input.name);

    const created = await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: input.name,
          slug,
          description: input.description || null,
          icon: input.icon,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
        },
        include: categoryInclude,
      });
      await writeAudit(tx, admin.id, 'category.created', 'CATEGORY', category.id, {
        name: category.name,
        slug: category.slug,
      });
      return category;
    });

    res.status(201).json({ data: toAdminCategory(created) });
  }),
);

adminRouter.patch(
  '/categories/:id',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const categoryId = parseId(req.params.id, 'category');
    const input = parseBody(categoryPatchSchema, req.body);

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, isActive: true },
    });
    if (!category) throw notFound('Category not found.');
    if (Object.keys(input).length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Provide at least one field to update.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.category.update({
        where: { id: categoryId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description || null } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
        include: categoryInclude,
      });
      if (input.isActive !== undefined && input.isActive !== category.isActive) {
        const affected = await tx.serviceListing.findMany({
          where: { categoryId },
          select: { providerId: true },
          distinct: ['providerId'],
        });
        for (const listing of affected) {
          await recalcProviderStats(listing.providerId, tx);
        }
      }
      await writeAudit(tx, admin.id, 'category.updated', 'CATEGORY', categoryId, {
        previousName: category.name,
        changes: input,
      });
      return row;
    });

    res.json({ data: toAdminCategory(updated) });
  }),
);

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

async function assertNoLocationCycle(locationId: string, parentId: string) {
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  while (cursor) {
    if (cursor === locationId) {
      throw new ApiError(400, 'LOCATION_CYCLE', 'A location cannot be placed under one of its own children.');
    }
    if (seen.has(cursor)) break;
    seen.add(cursor);
    const parent: { parentLocationId: string | null } | null = await prisma.location.findUnique({
      where: { id: cursor },
      select: { parentLocationId: true },
    });
    cursor = parent?.parentLocationId ?? null;
  }
}

async function validateLocationParent(
  locationType: string,
  parentId: string | null,
  ownId: string | null = null,
): Promise<void> {
  if (locationType === 'REGION') {
    if (parentId) {
      throw new ApiError(400, 'INVALID_LOCATION_PARENT', 'A region cannot have a parent location.');
    }
    return;
  }
  if (!parentId) {
    throw new ApiError(400, 'INVALID_LOCATION_PARENT', 'Choose a parent location for this place.');
  }
  if (ownId && parentId === ownId) {
    throw new ApiError(400, 'INVALID_LOCATION_PARENT', 'A location cannot be its own parent.');
  }
  const parent = await prisma.location.findUnique({
    where: { id: parentId },
    select: { id: true, locationType: true },
  });
  if (!parent) throw new ApiError(400, 'INVALID_LOCATION_PARENT', 'The parent location does not exist.');
  if (!childTypeAllowed(parent.locationType, locationType)) {
    throw new ApiError(400, 'INVALID_LOCATION_PARENT', 'That parent cannot contain this type of location.');
  }
  if (ownId) await assertNoLocationCycle(ownId, parentId);
}

async function assertParentActive(parentId: string | null): Promise<void> {
  if (!parentId) return;
  const parent = await prisma.location.findUnique({
    where: { id: parentId },
    select: { isActive: true },
  });
  if (!parent?.isActive) {
    throw new ApiError(
      400,
      'INACTIVE_LOCATION_PARENT',
      'Activate the parent location before making this place active.',
    );
  }
}

async function deactivateDescendants(tx: Prisma.TransactionClient, locationId: string): Promise<number> {
  let deactivated = 0;
  let frontier = [locationId];
  while (frontier.length > 0) {
    const children = await tx.location.findMany({
      where: { parentLocationId: { in: frontier } },
      select: { id: true },
    });
    if (children.length === 0) break;
    const ids = children.map((child) => child.id);
    const result = await tx.location.updateMany({
      where: { id: { in: ids }, isActive: true },
      data: { isActive: false },
    });
    deactivated += result.count;
    frontier = ids;
  }
  return deactivated;
}

adminRouter.get(
  '/locations',
  asyncHandler(async (_req, res) => {
    const rows = await prisma.location.findMany({
      include: locationInclude,
      orderBy: [{ locationType: 'asc' }, { name: 'asc' }],
    });
    res.json({ data: rows.map(toAdminLocation) });
  }),
);

adminRouter.post(
  '/locations',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const input = parseBody(locationInputSchema, req.body);
    const parentId = input.parentId ?? null;
    await validateLocationParent(input.locationType, parentId);
    if (input.isActive) await assertParentActive(parentId);

    const created = await prisma.$transaction(async (tx) => {
      const location = await tx.location.create({
        data: {
          name: input.name,
          locationType: input.locationType,
          parentLocationId: parentId,
          isActive: input.isActive,
        },
        include: locationInclude,
      });
      await writeAudit(tx, admin.id, 'location.created', 'LOCATION', location.id, {
        name: location.name,
        locationType: location.locationType,
        parentId,
      });
      return location;
    });

    res.status(201).json({ data: toAdminLocation(created) });
  }),
);

adminRouter.patch(
  '/locations/:id',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const locationId = parseId(req.params.id, 'location');
    const input = parseBody(locationPatchSchema, req.body);

    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) throw notFound('Location not found.');
    if (Object.keys(input).length === 0) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Provide at least one field to update.');
    }

    const nextType = input.locationType ?? location.locationType;
    const nextParentId =
      input.parentId !== undefined ? (input.parentId ?? null) : location.parentLocationId;
    const nextIsActive = input.isActive ?? location.isActive;
    if (nextType !== location.locationType || nextParentId !== location.parentLocationId) {
      await validateLocationParent(nextType, nextParentId, locationId);
    }
    if (nextIsActive) await assertParentActive(nextType === 'REGION' ? null : nextParentId);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.location.update({
        where: { id: locationId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.locationType !== undefined ? { locationType: input.locationType } : {}),
          ...(input.parentId !== undefined ? { parentLocationId: input.parentId ?? null } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
        include: locationInclude,
      });
      const deactivatedDescendants =
        input.isActive === false ? await deactivateDescendants(tx, locationId) : 0;
      await writeAudit(tx, admin.id, 'location.updated', 'LOCATION', locationId, {
        previous: { name: location.name, locationType: location.locationType, parentId: location.parentLocationId },
        changes: input,
        ...(deactivatedDescendants > 0 ? { deactivatedDescendants } : {}),
      });
      return { row, deactivatedDescendants };
    });

    res.json({ data: toAdminLocation(updated.row) });
  }),
);

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const reviewListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  moderationStatus: z.enum(REVIEW_MODERATION_STATUSES).optional(),
});

adminRouter.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const query = parseQuery(reviewListQuerySchema, req.query);
    const where: Prisma.ReviewWhereInput = {
      ...(query.moderationStatus ? { moderationStatus: query.moderationStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { comment: { contains: query.q } },
              { customer: { is: { fullName: { contains: query.q } } } },
              { provider: { is: { businessName: { contains: query.q } } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: adminReviewInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    res.json({ data: rows.map(toAdminReview), meta: buildPageMeta(total, query.page, query.pageSize) });
  }),
);

adminRouter.patch(
  '/reviews/:id/moderation',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const reviewId = parseId(req.params.id, 'review');
    const input = parseBody(reviewModerationSchema, req.body);

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, providerId: true, moderationStatus: true, rating: true },
    });
    if (!review) throw notFound('Review not found.');

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: { moderationStatus: input.moderationStatus },
        include: adminReviewInclude,
      });
      await recalcProviderStats(review.providerId, tx);
      await writeAudit(tx, admin.id, 'review.moderated', 'REVIEW', reviewId, {
        previousStatus: review.moderationStatus,
        moderationStatus: input.moderationStatus,
        rating: review.rating,
        reason: input.reason ?? null,
        providerId: review.providerId,
      });
      return updated;
    });

    res.json({ data: toAdminReview(row) });
  }),
);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const reportListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(REPORT_STATUSES).optional(),
});

adminRouter.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const query = parseQuery(reportListQuerySchema, req.query);
    const where: Prisma.ReportWhereInput = query.status ? { status: query.status } : {};

    const [total, rows] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        include: reportInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    res.json({ data: await buildReportDtos(rows), meta: buildPageMeta(total, query.page, query.pageSize) });
  }),
);

adminRouter.patch(
  '/reports/:id',
  asyncHandler(async (req, res) => {
    const admin = currentUser(req);
    const reportId = parseId(req.params.id, 'report');
    const input = parseBody(reportUpdateSchema, req.body);

    const report = await prisma.report.findUnique({ where: { id: reportId }, select: { status: true } });
    if (!report) throw notFound('Report not found.');
    if (report.status !== 'OPEN') {
      throw new ApiError(409, 'REPORT_CLOSED', 'This report was already resolved.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: {
          status: input.status,
          resolutionNote: input.resolutionNote,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });
      await writeAudit(tx, admin.id, 'report.resolved', 'REPORT', reportId, {
        status: input.status,
        resolutionNote: input.resolutionNote,
      });
    });

    const row = await prisma.report.findUniqueOrThrow({ where: { id: reportId }, include: reportInclude });
    const [dto] = await buildReportDtos([row]);
    res.json({ data: dto });
  }),
);

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

const auditListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
});

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const query = parseQuery(auditListQuerySchema, req.query);
    const where: Prisma.AuditLogWhereInput = query.q
      ? {
          OR: [
            { action: { contains: query.q } },
            { entityType: { contains: query.q } },
            { entityId: query.q },
            { actor: { is: { fullName: { contains: query.q } } } },
            { actor: { is: { email: { contains: query.q } } } },
          ],
        }
      : {};

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: auditInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    res.json({ data: rows.map(toAuditLog), meta: buildPageMeta(total, query.page, query.pageSize) });
  }),
);

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  paginationQuerySchema,
  portfolioCaptionSchema,
  providerProfileUpdateSchema,
  providerVerificationInputSchema,
  reviewResponseSchema,
  serviceAreasSchema,
  serviceInputSchema,
  servicePatchSchema,
} from '../../../shared/contracts';
import { REQUEST_STATUSES } from '../../../shared/contracts';
import type {
  ProviderDashboardDto,
  ProviderSelf,
  ReviewDto,
  ServiceRequestSummary,
} from '../../../shared/api-types';
import { config } from '../config';
import { ApiError, asyncHandler, parseBody, parseId, parseQuery } from '../lib/http';
import { deleteStoredImage, storeImage } from '../lib/images';
import {
  providerSelfInclude,
  requestSummaryInclude,
  toListing,
  toProviderSelf,
  toRequestSummary,
  toReview,
  toVerification,
} from '../lib/serialize';
import { currentProvider } from '../middleware/session';
import { requireRole } from '../middleware/session';
import { writeLimiter } from '../middleware/rateLimit';
import { prisma } from '../prisma';
import {
  countCompletedJobs,
  recalcProviderStats,
} from '../services/providerStats';
import { loadProviderMatchContext, openRequestWhereForProvider } from '../services/matching';
import { buildPageMeta } from './providers';

export const providerMeRouter = Router();

// Scope the guard to /me so the same router can be mounted alongside the
// public /api/providers routes without blocking anonymous browsing.
providerMeRouter.use('/me', requireRole('PROVIDER'), writeLimiter);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new ApiError(400, 'INVALID_FILE', 'Upload a JPEG, PNG, or WebP image.'));
    }
    callback(null, true);
  },
});

async function loadSelf(providerId: string): Promise<ProviderSelf> {
  const [profile, completedJobs] = await Promise.all([
    prisma.providerProfile.findUniqueOrThrow({ where: { id: providerId }, include: providerSelfInclude }),
    countCompletedJobs(providerId),
  ]);
  return toProviderSelf(profile, completedJobs);
}

async function storeUploadedImage(buffer: Buffer | undefined): Promise<string> {
  if (!buffer) throw new ApiError(400, 'NO_FILE', 'Choose an image to upload.');
  try {
    return await storeImage(buffer);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNSUPPORTED_IMAGE') {
      throw new ApiError(400, 'INVALID_FILE', 'That file is not a valid JPEG, PNG, or WebP image.');
    }
    throw error;
  }
}

providerMeRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    res.json({ data: await loadSelf(provider.id) });
  }),
);

providerMeRouter.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const input = parseBody(providerProfileUpdateSchema, req.body);

    await prisma.providerProfile.update({
      where: { id: provider.id },
      data: {
        businessName: input.businessName,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.yearsOfExperience !== undefined ? { yearsOfExperience: input.yearsOfExperience } : {}),
        ...(provider.approvalStatus === 'REJECTED'
          ? { approvalStatus: 'PENDING', rejectionReason: null }
          : {}),
      },
    });

    res.json({ data: await loadSelf(provider.id) });
  }),
);

providerMeRouter.get(
  '/me/dashboard',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const context = provider.approvalStatus === 'APPROVED' ? await loadProviderMatchContext(provider.id) : null;
    const openWhere = context ? openRequestWhereForProvider(context, provider.id) : null;

    const [newOpportunities, activeJobs, completedJobs, pendingQuotes, recentOpportunities, recentEngaged, recentReviews, activeListingCount, areaCount, verificationCount] =
      await Promise.all([
        openWhere ? prisma.serviceRequest.count({ where: openWhere }) : 0,
        prisma.serviceRequest.count({
          where: { assignedProviderId: provider.id, status: { in: ['ACCEPTED', 'IN_PROGRESS'] } },
        }),
        prisma.serviceRequest.count({ where: { assignedProviderId: provider.id, status: 'COMPLETED' } }),
        prisma.quote.count({ where: { providerId: provider.id, status: 'PENDING' } }),
        openWhere
          ? prisma.serviceRequest.findMany({
              where: openWhere,
              include: requestSummaryInclude,
              orderBy: { createdAt: 'desc' },
              take: 4,
            })
          : Promise.resolve([]),
        prisma.serviceRequest.findMany({
          where: { OR: [{ assignedProviderId: provider.id }, { quotes: { some: { providerId: provider.id } } }] },
          include: requestSummaryInclude,
          orderBy: { updatedAt: 'desc' },
          take: 4,
        }),
        prisma.review.findMany({
          where: { providerId: provider.id, moderationStatus: 'VISIBLE' },
          include: { customer: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 3,
        }),
        prisma.serviceListing.count({ where: { providerId: provider.id, isActive: true } }),
        prisma.providerServiceArea.count({ where: { providerId: provider.id } }),
        prisma.providerVerification.count({
          where: { providerId: provider.id, status: { in: ['PENDING', 'APPROVED'] } },
        }),
      ]);

    const missing: string[] = [];
    if (!provider.profileImage) missing.push('Add a profile photo');
    if (provider.description.trim().length < 40) missing.push('Write a short description');
    if (areaCount === 0) missing.push('Choose at least one service area');
    if (activeListingCount === 0) missing.push('Add an active service');
    if (verificationCount === 0) missing.push('Submit an identity or business verification');

    const recentMap = new Map<string, ServiceRequestSummary>();
    for (const row of [...recentOpportunities, ...recentEngaged]) {
      recentMap.set(row.id, toRequestSummary(row, provider.id));
    }
    const recentRequests = [...recentMap.values()]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    const dashboard: ProviderDashboardDto = {
      counts: {
        newOpportunities,
        activeJobs,
        completedJobs,
        pendingQuotes,
        reviewCount: provider.reviewCount,
      },
      profile: {
        approvalStatus: provider.approvalStatus as ProviderDashboardDto['profile']['approvalStatus'],
        verificationStatus: provider.verificationStatus as ProviderDashboardDto['profile']['verificationStatus'],
        completeness: Math.round(((5 - missing.length) / 5) * 100),
        missing,
      },
      recentRequests,
      recentReviews: recentReviews.map(toReview),
    };

    res.json({ data: dashboard });
  }),
);

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

providerMeRouter.post(
  '/me/services',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const input = parseBody(serviceInputSchema, req.body);
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) throw new ApiError(400, 'INVALID_CATEGORY', 'Choose an active service category.');

    const listing = await prisma.serviceListing.create({
      data: {
        providerId: provider.id,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description ?? null,
        startingPrice: input.startingPrice,
        diagnosticFee: input.diagnosticFee ?? null,
        priceType: input.priceType,
        requiresInspection: input.requiresInspection,
        isActive: input.isActive,
      },
      include: { category: true },
    });
    await recalcProviderStats(provider.id);
    res.status(201).json({ data: toListing(listing) });
  }),
);

providerMeRouter.patch(
  '/me/services/:serviceId',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const serviceId = parseId(req.params.serviceId, 'service');
    const existing = await prisma.serviceListing.findFirst({ where: { id: serviceId, providerId: provider.id } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Service not found.');

    const input = parseBody(servicePatchSchema, req.body);
    if (input.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: input.categoryId, isActive: true },
        select: { id: true },
      });
      if (!category) throw new ApiError(400, 'INVALID_CATEGORY', 'Choose an active service category.');
    }

    const listing = await prisma.serviceListing.update({
      where: { id: serviceId },
      data: {
        ...input,
        description: input.description === undefined ? undefined : input.description,
        diagnosticFee: input.diagnosticFee === undefined ? undefined : input.diagnosticFee,
      },
      include: { category: true },
    });
    await recalcProviderStats(provider.id);
    res.json({ data: toListing(listing) });
  }),
);

providerMeRouter.delete(
  '/me/services/:serviceId',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const serviceId = parseId(req.params.serviceId, 'service');
    const existing = await prisma.serviceListing.findFirst({ where: { id: serviceId, providerId: provider.id } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Service not found.');
    await prisma.serviceListing.delete({ where: { id: serviceId } });
    await recalcProviderStats(provider.id);
    res.status(204).end();
  }),
);

providerMeRouter.put(
  '/me/service-areas',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const input = parseBody(serviceAreasSchema, req.body);

    if (input.locationIds.length > 0) {
      const locations = await prisma.location.findMany({
        where: { id: { in: input.locationIds }, isActive: true },
        select: { id: true },
      });
      if (locations.length !== input.locationIds.length) {
        throw new ApiError(400, 'INVALID_LOCATION', 'One or more selected locations are not available.');
      }
    }

    await prisma.$transaction([
      prisma.providerServiceArea.deleteMany({ where: { providerId: provider.id } }),
      ...(input.locationIds.length > 0
        ? [
            prisma.providerServiceArea.createMany({
              data: input.locationIds.map((locationId) => ({ providerId: provider.id, locationId })),
            }),
          ]
        : []),
    ]);

    res.json({ data: await loadSelf(provider.id) });
  }),
);

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

providerMeRouter.post(
  '/me/avatar',
  imageUpload.single('avatar'),
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const imageUrl = await storeUploadedImage(req.file?.buffer);
    await prisma.providerProfile.update({ where: { id: provider.id }, data: { profileImage: imageUrl } });
    await deleteStoredImage(provider.profileImage);
    res.json({ data: await loadSelf(provider.id) });
  }),
);

providerMeRouter.post(
  '/me/portfolio',
  imageUpload.single('image'),
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const count = await prisma.portfolioImage.count({ where: { providerId: provider.id } });
    if (count >= 12) {
      throw new ApiError(409, 'PORTFOLIO_LIMIT', 'You can have up to 12 portfolio images. Remove one first.');
    }
    const caption = parseBody(portfolioCaptionSchema, req.body).caption ?? null;
    const imageUrl = await storeUploadedImage(req.file?.buffer);
    await prisma.portfolioImage.create({
      data: { providerId: provider.id, imageUrl, caption },
    });
    res.status(201).json({ data: await loadSelf(provider.id) });
  }),
);

providerMeRouter.delete(
  '/me/portfolio/:imageId',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const imageId = parseId(req.params.imageId, 'portfolio image');
    const image = await prisma.portfolioImage.findFirst({ where: { id: imageId, providerId: provider.id } });
    if (!image) throw new ApiError(404, 'NOT_FOUND', 'Portfolio image not found.');
    await prisma.portfolioImage.delete({ where: { id: image.id } });
    await deleteStoredImage(image.imageUrl);
    res.json({ data: await loadSelf(provider.id) });
  }),
);

// ---------------------------------------------------------------------------
// Requests, quotes and reviews
// ---------------------------------------------------------------------------

const providerRequestsQuerySchema = paginationQuerySchema.extend({
  view: z.enum(['opportunities', 'quotes', 'jobs']).default('opportunities'),
  status: z.enum(REQUEST_STATUSES).optional(),
});

providerMeRouter.get(
  '/me/requests',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const query = parseQuery(providerRequestsQuerySchema, req.query);

    let where: Prisma.ServiceRequestWhereInput;
    let orderBy: Prisma.ServiceRequestOrderByWithRelationInput = { updatedAt: 'desc' };

    if (query.view === 'opportunities') {
      if (provider.approvalStatus !== 'APPROVED') {
        res.json({ data: [], meta: buildPageMeta(0, query.page, query.pageSize) });
        return;
      }
      const context = await loadProviderMatchContext(provider.id);
      if (!context) {
        res.json({ data: [], meta: buildPageMeta(0, query.page, query.pageSize) });
        return;
      }
      where = openRequestWhereForProvider(context, provider.id);
      if (query.status) {
        where = { AND: [where, { status: query.status }] };
      }
      orderBy = { createdAt: 'desc' };
    } else if (query.view === 'quotes') {
      where = {
        quotes: { some: { providerId: provider.id } },
        ...(query.status ? { status: query.status } : {}),
      };
    } else {
      where = {
        assignedProviderId: provider.id,
        ...(query.status ? { status: query.status } : {}),
      };
    }

    const [total, rows] = await Promise.all([
      prisma.serviceRequest.count({ where }),
      prisma.serviceRequest.findMany({
        where,
        include: requestSummaryInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const data = rows.map((row) => toRequestSummary(row, provider.id));
    res.json({ data, meta: buildPageMeta(total, query.page, query.pageSize) });
  }),
);

providerMeRouter.get(
  '/me/reviews',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const { page, pageSize } = parseQuery(paginationQuerySchema, req.query);
    const where = { providerId: provider.id, moderationStatus: 'VISIBLE' };
    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: { customer: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    const data: ReviewDto[] = reviews.map(toReview);
    res.json({ data, meta: buildPageMeta(total, page, pageSize) });
  }),
);

providerMeRouter.patch(
  '/me/reviews/:reviewId/response',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const reviewId = parseId(req.params.reviewId, 'review');
    const review = await prisma.review.findFirst({
      where: { id: reviewId, providerId: provider.id, moderationStatus: 'VISIBLE' },
      include: { customer: { select: { fullName: true } } },
    });
    if (!review) throw new ApiError(404, 'NOT_FOUND', 'Review not found.');
    const input = parseBody(reviewResponseSchema, req.body);
    const updated = await prisma.review.update({
      where: { id: review.id },
      data: { providerResponse: input.response, providerRespondedAt: new Date() },
      include: { customer: { select: { fullName: true } } },
    });
    res.json({ data: toReview(updated) });
  }),
);

providerMeRouter.post(
  '/me/verifications',
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const input = parseBody(providerVerificationInputSchema, req.body);
    if (provider.approvalStatus !== 'APPROVED') {
      throw new ApiError(
        409,
        'PROVIDER_NOT_APPROVED',
        'Your provider profile must be approved before you can request verification.',
      );
    }
    if (
      (input.verificationType === 'IDENTITY' && provider.identityVerifiedAt) ||
      (input.verificationType === 'BUSINESS' && provider.businessVerifiedAt)
    ) {
      throw new ApiError(409, 'ALREADY_VERIFIED', 'This verification is already complete.');
    }
    const pending = await prisma.providerVerification.findFirst({
      where: { providerId: provider.id, verificationType: input.verificationType, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new ApiError(409, 'VERIFICATION_PENDING', 'A request for this verification is already pending.');
    }

    const verification = await prisma.providerVerification.create({
      data: {
        providerId: provider.id,
        verificationType: input.verificationType,
        note: input.note,
      },
    });
    res.status(201).json({ data: toVerification(verification) });
  }),
);

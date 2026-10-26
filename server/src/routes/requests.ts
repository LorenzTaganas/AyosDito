import { Router } from 'express';
import { z } from 'zod';
import {
  paginationQuerySchema,
  quoteCreateSchema,
  requestCreateSchema,
  reviewCreateSchema,
} from '../../../shared/contracts';
import { REQUEST_STATUSES } from '../../../shared/contracts';
import type { ServiceRequestDetail } from '../../../shared/api-types';
import { ApiError, asyncHandler, forbidden, notFound, parseBody, parseId, parseQuery } from '../lib/http';
import {
  quoteProviderSelect,
  requestDetailInclude,
  requestSummaryInclude,
  toQuote,
  toRequestDetail,
  toRequestSummary,
  toReview,
} from '../lib/serialize';
import { currentProvider, currentUser, requireAuth, requireRole } from '../middleware/session';
import { writeLimiter } from '../middleware/rateLimit';
import { prisma } from '../prisma';
import { recalcProviderStats } from '../services/providerStats';
import { expandRelatedLocationIds } from '../services/locations';
import { getProviderRequestAccess } from '../services/matching';
import { buildPageMeta } from './providers';

export const requestsRouter = Router();

requestsRouter.use(requireAuth);
requestsRouter.use(writeLimiter);

const CANCELLABLE = new Set(['PENDING', 'RESPONDED', 'ACCEPTED']);

async function loadRequestForViewer(req: Parameters<Parameters<typeof asyncHandler>[0]>[0], requestId: string) {
  const row = await prisma.serviceRequest.findUnique({
    where: { id: requestId },
    include: requestDetailInclude,
  });
  if (!row) throw notFound('Request not found.');
  const user = currentUser(req);

  if (user.role === 'CUSTOMER') {
    if (row.customerId !== user.id) throw notFound('Request not found.');
    return {
      row,
      viewer: { userId: user.id, role: user.role, providerId: null as string | null, providerCanQuote: false },
    };
  }

  if (user.role === 'ADMIN') {
    return {
      row,
      viewer: { userId: user.id, role: user.role, providerId: null as string | null, providerCanQuote: false },
    };
  }

  if (!user.providerProfile) throw forbidden('Complete a provider account to view requests.');
  const providerId = user.providerProfile.id;
  const hasQuote = row.quotes.some((quote) => quote.providerId === providerId);
  const access = await getProviderRequestAccess(providerId, row, hasQuote);
  if (!access.allowed) {
    throw forbidden('This request is outside your service categories or areas.');
  }
  return {
    row,
    viewer: { userId: user.id, role: user.role, providerId, providerCanQuote: access.canQuote },
  };
}

async function detailForCustomer(requestId: string, customerId: string): Promise<ServiceRequestDetail> {
  const row = await prisma.serviceRequest.findUnique({ where: { id: requestId }, include: requestDetailInclude });
  if (!row || row.customerId !== customerId) throw notFound('Request not found.');
  return toRequestDetail(row, {
    userId: customerId,
    role: 'CUSTOMER',
    providerId: null,
    providerCanQuote: false,
  });
}

requestsRouter.post(
  '/',
  requireRole('CUSTOMER'),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const input = parseBody(requestCreateSchema, req.body);
    const [category, location] = await Promise.all([
      prisma.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } }),
      prisma.location.findFirst({ where: { id: input.locationId, isActive: true }, select: { id: true } }),
    ]);
    if (!category) throw new ApiError(400, 'INVALID_CATEGORY', 'Choose an active service category.');
    if (!location) throw new ApiError(400, 'INVALID_LOCATION', 'Choose an available location.');

    if (input.targetProviderId) {
      const related = [...(await expandRelatedLocationIds([location.id]))];
      const target = await prisma.providerProfile.findFirst({
        where: {
          id: input.targetProviderId,
          approvalStatus: 'APPROVED',
          user: { accountStatus: 'ACTIVE', role: 'PROVIDER' },
          listings: { some: { isActive: true, categoryId: category.id, category: { isActive: true } } },
          serviceAreas: { some: { locationId: { in: related }, location: { isActive: true } } },
        },
        select: { id: true },
      });
      if (!target) {
        throw new ApiError(
          400,
          'TARGET_PROVIDER_UNAVAILABLE',
          'That provider does not offer this service in the selected location.',
        );
      }
    }

    const created = await prisma.serviceRequest.create({
      data: {
        customerId: user.id,
        categoryId: category.id,
        title: input.title,
        problemDescription: input.problemDescription,
        locationId: location.id,
        preferredSchedule: input.preferredSchedule || null,
        targetProviderId: input.targetProviderId ?? null,
      },
      include: requestDetailInclude,
    });

    res.status(201).json({
      data: toRequestDetail(created, {
        userId: user.id,
        role: 'CUSTOMER',
        providerId: null,
        providerCanQuote: false,
      }),
    });
  }),
);

const myRequestsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(REQUEST_STATUSES).optional(),
});

requestsRouter.get(
  '/me',
  requireRole('CUSTOMER'),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const query = parseQuery(myRequestsQuerySchema, req.query);
    const where = { customerId: user.id, ...(query.status ? { status: query.status } : {}) };
    const [total, rows] = await Promise.all([
      prisma.serviceRequest.count({ where }),
      prisma.serviceRequest.findMany({
        where,
        include: requestSummaryInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    res.json({
      data: rows.map((row) => toRequestSummary(row)),
      meta: buildPageMeta(total, query.page, query.pageSize),
    });
  }),
);

requestsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const requestId = parseId(req.params.id, 'request');
    const { row, viewer } = await loadRequestForViewer(req, requestId);
    res.json({ data: toRequestDetail(row, viewer) });
  }),
);

requestsRouter.get(
  '/:id/quotes',
  asyncHandler(async (req, res) => {
    const requestId = parseId(req.params.id, 'request');
    const { row, viewer } = await loadRequestForViewer(req, requestId);
    const quotes =
      req.auth?.user.role === 'PROVIDER' && viewer.providerId
        ? row.quotes.filter((quote) => quote.providerId === viewer.providerId)
        : row.quotes;
    res.json({ data: quotes.map(toQuote) });
  }),
);

requestsRouter.patch(
  '/:id/cancel',
  requireRole('CUSTOMER'),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const requestId = parseId(req.params.id, 'request');
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, customerId: user.id },
      select: { id: true, status: true },
    });
    if (!request) throw notFound('Request not found.');
    if (!CANCELLABLE.has(request.status)) {
      throw new ApiError(409, 'INVALID_TRANSITION', 'This request can no longer be cancelled.');
    }

    await prisma.$transaction([
      prisma.serviceRequest.update({
        where: { id: request.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      }),
      prisma.quote.updateMany({
        where: { serviceRequestId: request.id, status: 'PENDING' },
        data: { status: 'DECLINED' },
      }),
    ]);

    res.json({ data: await detailForCustomer(requestId, user.id) });
  }),
);

const jobStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),
});

requestsRouter.patch(
  '/:id/status',
  requireRole('PROVIDER'),
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    const requestId = parseId(req.params.id, 'request');
    const input = parseBody(jobStatusSchema, req.body);
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, assignedProviderId: provider.id },
      select: { id: true, status: true },
    });
    if (!request) throw notFound('Assigned request not found.');

    if (input.status === 'IN_PROGRESS' && request.status !== 'ACCEPTED') {
      throw new ApiError(409, 'INVALID_TRANSITION', 'Only an accepted job can be started.');
    }
    if (input.status === 'COMPLETED' && request.status !== 'IN_PROGRESS') {
      throw new ApiError(409, 'INVALID_TRANSITION', 'Mark the job in progress before completing it.');
    }

    await prisma.serviceRequest.update({
      where: { id: request.id },
      data: {
        status: input.status,
        ...(input.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
      },
    });

    const row = await prisma.serviceRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: requestDetailInclude,
    });
    res.json({
      data: toRequestDetail(row, {
        userId: req.auth!.user.id,
        role: 'PROVIDER',
        providerId: provider.id,
        providerCanQuote: false,
      }),
    });
  }),
);

requestsRouter.post(
  '/:id/quotes',
  requireRole('PROVIDER'),
  asyncHandler(async (req, res) => {
    const provider = currentProvider(req);
    if (provider.approvalStatus !== 'APPROVED') {
      throw new ApiError(403, 'PROVIDER_NOT_APPROVED', 'Your provider application is still under review.');
    }
    const requestId = parseId(req.params.id, 'request');
    const input = parseBody(quoteCreateSchema, req.body);
    const request = await prisma.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        categoryId: true,
        locationId: true,
        status: true,
        targetProviderId: true,
        assignedProviderId: true,
        quotes: { where: { providerId: provider.id }, select: { id: true } },
      },
    });
    if (!request) throw notFound('Request not found.');
    if (!['PENDING', 'RESPONDED'].includes(request.status)) {
      throw new ApiError(409, 'REQUEST_CLOSED', 'This request is no longer accepting quotes.');
    }
    if (request.quotes.length > 0) {
      throw new ApiError(409, 'ALREADY_QUOTED', 'You already sent a quote for this request.');
    }
    const access = await getProviderRequestAccess(provider.id, request, false);
    if (!access.canQuote) {
      throw forbidden('This request is outside your approved categories or service areas.');
    }

    const quote = await prisma.$transaction(async (tx) => {
      const created = await tx.quote.create({
        data: {
          serviceRequestId: request.id,
          providerId: provider.id,
          proposedPrice: input.proposedPrice,
          priceNotes: input.priceNotes ?? null,
          estimatedDuration: input.estimatedDuration ?? null,
        },
        include: { provider: { select: quoteProviderSelect } },
      });
      if (request.status === 'PENDING') {
        await tx.serviceRequest.update({ where: { id: request.id }, data: { status: 'RESPONDED' } });
      }
      return created;
    });

    res.status(201).json({ data: toQuote(quote) });
  }),
);

requestsRouter.post(
  '/:id/review',
  requireRole('CUSTOMER'),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const requestId = parseId(req.params.id, 'request');
    const input = parseBody(reviewCreateSchema, req.body);
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, customerId: user.id },
      include: { review: { select: { id: true } } },
    });
    if (!request) throw notFound('Request not found.');
    if (request.status !== 'COMPLETED' || !request.assignedProviderId) {
      throw new ApiError(409, 'REVIEW_NOT_ALLOWED', 'Reviews open after a provider completes the job.');
    }
    if (request.review) {
      throw new ApiError(409, 'ALREADY_REVIEWED', 'You already reviewed this request.');
    }

    const providerId = request.assignedProviderId;
    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          serviceRequestId: request.id,
          customerId: user.id,
          providerId,
          rating: input.rating,
          comment: input.comment || null,
        },
        include: { customer: { select: { fullName: true } } },
      });
      await recalcProviderStats(providerId, tx);
      return created;
    });

    res.status(201).json({ data: toReview(review) });
  }),
);

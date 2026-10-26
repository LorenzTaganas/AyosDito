import { Router } from 'express';
import { reportCreateSchema } from '../../../shared/contracts';
import type { z } from 'zod';
import { ApiError, asyncHandler, notFound, parseBody, parseId } from '../lib/http';
import { currentUser, requireAuth } from '../middleware/session';
import { writeLimiter } from '../middleware/rateLimit';
import { prisma } from '../prisma';

type ReportInput = z.infer<typeof reportCreateSchema>;

async function createReport(reporterId: string, input: ReportInput) {
  const duplicate = await prisma.report.findFirst({
    where: {
      reporterId,
      reportedEntityType: input.entityType,
      reportedEntityId: input.entityId,
      status: 'OPEN',
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ApiError(409, 'REPORT_ALREADY_OPEN', 'You already have an open report for this item.');
  }

  if (input.entityType === 'PROVIDER') {
    const provider = await prisma.providerProfile.findUnique({
      where: { id: input.entityId },
      select: { id: true, userId: true },
    });
    if (!provider) throw notFound('Provider not found.');
    if (provider.userId === reporterId) {
      throw new ApiError(400, 'CANNOT_REPORT_SELF', 'You cannot report your own provider profile.');
    }
  } else {
    const review = await prisma.review.findUnique({
      where: { id: input.entityId },
      select: { id: true, customerId: true, providerId: true, moderationStatus: true },
    });
    if (!review || review.moderationStatus !== 'VISIBLE') throw notFound('Review not found.');
    if (review.customerId === reporterId) {
      throw new ApiError(400, 'CANNOT_REPORT_SELF', 'You cannot report a review you wrote.');
    }
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      reportedEntityType: input.entityType,
      reportedEntityId: input.entityId,
      reason: input.reason,
      description: input.description,
    },
    select: { id: true, status: true, createdAt: true },
  });

  return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
}

export const reportsRouter = Router();

reportsRouter.use(requireAuth);
reportsRouter.use(writeLimiter);

reportsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const input = parseBody(reportCreateSchema, req.body);
    const data = await createReport(user.id, input);
    res.status(201).json({ data });
  }),
);

const reviewReportSchema = reportCreateSchema.pick({ reason: true, description: true });

export const reviewReportsRouter = Router();

reviewReportsRouter.use(requireAuth);
reviewReportsRouter.use(writeLimiter);

reviewReportsRouter.post(
  '/:id/report',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const reviewId = parseId(req.params.id, 'review');
    const input = parseBody(reviewReportSchema, req.body);
    const data = await createReport(user.id, { ...input, entityType: 'REVIEW', entityId: reviewId });
    res.status(201).json({ data });
  }),
);

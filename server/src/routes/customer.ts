import { Router } from 'express';
import { customerProfileUpdateSchema } from '../../../shared/contracts';
import type { CustomerDashboardDto, ServiceRequestSummary } from '../../../shared/api-types';
import { ApiError, asyncHandler, parseBody } from '../lib/http';
import {
  requestSummaryInclude,
  toAuthUser,
  toRequestSummary,
} from '../lib/serialize';
import { currentUser, requireRole, sessionUserInclude } from '../middleware/session';
import { prisma } from '../prisma';
import { getActiveLocation } from '../services/locations';

export const customerRouter = Router();

customerRouter.use(requireRole('CUSTOMER'));

customerRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const [grouped, favorites, quotesToReview, recentRequests] = await Promise.all([
      prisma.serviceRequest.groupBy({
        by: ['status'],
        where: { customerId: user.id },
        _count: { _all: true },
      }),
      prisma.favorite.count({ where: { customerId: user.id } }),
      prisma.quote.count({
        where: {
          status: 'PENDING',
          serviceRequest: { customerId: user.id, status: 'RESPONDED' },
        },
      }),
      prisma.serviceRequest.findMany({
        where: { customerId: user.id },
        include: requestSummaryInclude,
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    const byStatus = new Map(grouped.map((row) => [row.status, row._count._all]));
    const counts = {
      open: (byStatus.get('PENDING') ?? 0) + (byStatus.get('RESPONDED') ?? 0),
      active: (byStatus.get('ACCEPTED') ?? 0) + (byStatus.get('IN_PROGRESS') ?? 0),
      completed: byStatus.get('COMPLETED') ?? 0,
      total: [...byStatus.values()].reduce((sum, value) => sum + value, 0),
    };

    const data: CustomerDashboardDto = {
      counts,
      quotesToReview,
      favorites,
      recentRequests: recentRequests.map((row) => toRequestSummary(row)),
    };
    res.json({ data });
  }),
);

customerRouter.patch(
  '/me',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const input = parseBody(customerProfileUpdateSchema, req.body);

    if (input.preferredLocationId) {
      const location = await getActiveLocation(input.preferredLocationId);
      if (!location) throw new ApiError(400, 'INVALID_LOCATION', 'That location is not available.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.fullName) {
        await tx.user.update({ where: { id: user.id }, data: { fullName: input.fullName } });
      }
      await tx.customerProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          preferredLocationId: input.preferredLocationId ?? null,
        },
        update: {
          ...(input.preferredLocationId !== undefined
            ? { preferredLocationId: input.preferredLocationId }
            : {}),
        },
      });
      return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: sessionUserInclude });
    });

    res.json({ data: { user: toAuthUser(updated) } });
  }),
);

import { Router } from 'express';
import { paginationQuerySchema } from '../../../shared/contracts';
import type { ProviderSummary } from '../../../shared/api-types';
import { ApiError, asyncHandler, parseId, parseQuery } from '../lib/http';
import { providerCardInclude, toProviderSummary } from '../lib/serialize';
import { currentUser, requireRole } from '../middleware/session';
import { prisma } from '../prisma';
import { buildPageMeta } from './providers';

export const favoritesRouter = Router();

favoritesRouter.use(requireRole('CUSTOMER'));

favoritesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { page, pageSize } = parseQuery(paginationQuerySchema, req.query);

    const providerWhere = {
      approvalStatus: 'APPROVED',
      minStartingPrice: { not: null },
      user: { accountStatus: 'ACTIVE', role: 'PROVIDER' },
    };

    const [total, favorites] = await Promise.all([
      prisma.favorite.count({ where: { customerId: user.id, provider: providerWhere } }),
      prisma.favorite.findMany({
        where: { customerId: user.id, provider: providerWhere },
        include: { provider: { include: providerCardInclude } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const data: ProviderSummary[] = favorites.map((favorite) =>
      toProviderSummary(favorite.provider, favorite.provider.listings, favorite.provider.serviceAreas),
    );
    res.json({ data, meta: buildPageMeta(total, page, pageSize) });
  }),
);

favoritesRouter.post(
  '/:providerId',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const providerId = parseId(req.params.providerId, 'provider');
    const provider = await prisma.providerProfile.findFirst({
      where: {
        id: providerId,
        approvalStatus: 'APPROVED',
        user: { accountStatus: 'ACTIVE', role: 'PROVIDER' },
      },
      select: { id: true },
    });
    if (!provider) throw new ApiError(404, 'NOT_FOUND', 'Provider not found.');

    const favorite = await prisma.favorite.upsert({
      where: { customerId_providerId: { customerId: user.id, providerId } },
      create: { customerId: user.id, providerId },
      update: {},
    });
    res.status(201).json({ data: { id: favorite.id, createdAt: favorite.createdAt.toISOString() } });
  }),
);

favoritesRouter.delete(
  '/:providerId',
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const providerId = parseId(req.params.providerId, 'provider');
    await prisma.favorite.deleteMany({ where: { customerId: user.id, providerId } });
    res.status(204).end();
  }),
);

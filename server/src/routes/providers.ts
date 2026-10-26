import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { paginationQuerySchema, providerSearchSchema } from '../../../shared/contracts';
import type { PageMeta, ProviderSummary, ReviewDto } from '../../../shared/api-types';
import { ApiError, asyncHandler, notFound, parseId, parseQuery } from '../lib/http';
import {
  providerCardInclude,
  providerDetailInclude,
  toProviderDetail,
  toProviderSummary,
  toReview,
} from '../lib/serialize';
import { countCompletedJobs } from '../services/providerStats';
import { expandRelatedLocationIds, getActiveLocation } from '../services/locations';
import { prisma } from '../prisma';

export const providersRouter = Router();

/**
 * A provider is only discoverable while it has at least one live listing in an
 * active category and one service area in an active location. This keeps
 * deactivated catalog entries from leaking back into search results.
 */
const publicProviderVisibility: Prisma.ProviderProfileWhereInput = {
  approvalStatus: 'APPROVED',
  user: { accountStatus: 'ACTIVE', role: 'PROVIDER' },
  listings: { some: { isActive: true, category: { isActive: true } } },
  serviceAreas: { some: { location: { isActive: true } } },
};

function visibleListings<T extends { category: { isActive: boolean } }>(listings: T[]): T[] {
  return listings.filter((listing) => listing.category.isActive);
}

function visibleServiceAreas<T extends { location: { isActive: boolean } }>(areas: T[]): T[] {
  return areas.filter((area) => area.location.isActive);
}

export function buildPageMeta(total: number, page: number, pageSize: number): PageMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

providersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseQuery(providerSearchSchema, req.query);
    let categoryId: string | undefined;
    if (query.category) {
      const category = await prisma.category.findFirst({
        where: { slug: query.category, isActive: true },
        select: { id: true },
      });
      if (!category) throw new ApiError(400, 'INVALID_CATEGORY', 'That service category is not available.');
      categoryId = category.id;
    }

    let locationIds: string[] | undefined;
    if (query.locationId) {
      const location = await getActiveLocation(query.locationId);
      if (!location) throw new ApiError(400, 'INVALID_LOCATION', 'That location is not available.');
      locationIds = [...(await expandRelatedLocationIds([location.id]))];
    }

    const minPriceFilter: Prisma.IntNullableFilter = { not: null };
    if (query.minPrice !== undefined) minPriceFilter.gte = query.minPrice;
    if (query.maxPrice !== undefined) minPriceFilter.lte = query.maxPrice;

    const where: Prisma.ProviderProfileWhereInput = {
      ...publicProviderVisibility,
      minStartingPrice: minPriceFilter,
      ...(categoryId
        ? { listings: { some: { isActive: true, categoryId, category: { isActive: true } } } }
        : {}),
      ...(locationIds
        ? {
            serviceAreas: {
              some: { locationId: { in: locationIds }, location: { isActive: true } },
            },
          }
        : {}),
      ...(query.q
        ? {
            OR: [
              { businessName: { contains: query.q } },
              { description: { contains: query.q } },
              {
                listings: {
                  some: { isActive: true, category: { isActive: true }, title: { contains: query.q } },
                },
              },
              {
                listings: {
                  some: { isActive: true, category: { isActive: true }, description: { contains: query.q } },
                },
              },
            ],
          }
        : {}),
      ...(query.minRating !== undefined ? { reviewCount: { gte: 3 }, ratingAvg: { gte: query.minRating } } : {}),
      ...(query.verified === 'identity'
        ? { identityVerifiedAt: { not: null } }
        : query.verified === 'business'
          ? { businessVerifiedAt: { not: null } }
          : {}),
    };

    if (query.sort === 'rating') {
      where.reviewCount = { gte: 3 };
    }

    const orderBy: Prisma.ProviderProfileOrderByWithRelationInput[] =
      query.sort === 'rating'
        ? [{ ratingAvg: 'desc' }, { reviewCount: 'desc' }, { createdAt: 'asc' }]
        : query.sort === 'price_asc'
          ? [{ minStartingPrice: 'asc' }, { ratingScore: 'desc' }]
          : query.sort === 'price_desc'
            ? [{ minStartingPrice: 'desc' }, { ratingScore: 'desc' }]
            : query.sort === 'newest'
              ? [{ createdAt: 'desc' }]
              : [{ ratingScore: 'desc' }, { reviewCount: 'desc' }, { verificationRank: 'desc' }, { createdAt: 'asc' }];

    const [total, rows] = await Promise.all([
      prisma.providerProfile.count({ where }),
      prisma.providerProfile.findMany({
        where,
        include: providerCardInclude,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const data: ProviderSummary[] = rows.map((row) => toProviderSummary(row, row.listings, row.serviceAreas));
    res.json({
      data,
      meta: {
        ...buildPageMeta(total, query.page, query.pageSize),
        includesDemoData: rows.some((row) => row.isDemo),
      },
    });
  }),
);

async function findPublicProvider(id: string) {
  return prisma.providerProfile.findFirst({
    where: {
      id,
      ...publicProviderVisibility,
    },
  });
}

providersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'provider');
    const provider = await prisma.providerProfile.findFirst({
      where: {
        id,
        ...publicProviderVisibility,
      },
      include: providerDetailInclude,
    });
    if (!provider) throw notFound('Provider not found.');

    const [recentReviews, completedJobs, favorite] = await Promise.all([
      prisma.review.findMany({
        where: { providerId: id, moderationStatus: 'VISIBLE' },
        include: { customer: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      countCompletedJobs(id),
      req.auth?.user.role === 'CUSTOMER'
        ? prisma.favorite.findUnique({
            where: { customerId_providerId: { customerId: req.auth.user.id, providerId: id } },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    res.json({
      data: toProviderDetail(
        {
          ...provider,
          listings: visibleListings(provider.listings),
          serviceAreas: visibleServiceAreas(provider.serviceAreas),
        },
        {
          recentReviews: recentReviews.map(toReview),
          completedJobs,
          isFavorite: Boolean(favorite),
        },
      ),
    });
  }),
);

providersRouter.get(
  '/:id/reviews',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'provider');
    const provider = await findPublicProvider(id);
    if (!provider) throw notFound('Provider not found.');
    const { page, pageSize } = parseQuery(paginationQuerySchema, req.query);

    const [total, reviews] = await Promise.all([
      prisma.review.count({ where: { providerId: id, moderationStatus: 'VISIBLE' } }),
      prisma.review.findMany({
        where: { providerId: id, moderationStatus: 'VISIBLE' },
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

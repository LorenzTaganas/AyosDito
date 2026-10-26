import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';

type DbClient = PrismaClient | Prisma.TransactionClient;

export function verificationRank(identityVerified: boolean, businessVerified: boolean): number {
  if (businessVerified) return 2;
  if (identityVerified) return 1;
  return 0;
}

export function verificationStatusFor(identityVerified: boolean, businessVerified: boolean): string {
  if (businessVerified) return 'BUSINESS_VERIFIED';
  if (identityVerified) return 'IDENTITY_VERIFIED';
  return 'UNVERIFIED';
}

const RATING_PRIOR_MEAN = 4.2;
const RATING_PRIOR_COUNT = 3;

/**
 * Ratings are stored denormalized for filtering/sorting. The sort score is a
 * Bayesian average so a provider with a single 5-star review does not outrank
 * a consistently well-reviewed provider. Display always uses the real average
 * and review count.
 */
export async function recalcProviderStats(providerId: string, client: DbClient = prisma) {
  const [aggregate, cheapest] = await Promise.all([
    client.review.aggregate({
      where: { providerId, moderationStatus: 'VISIBLE' },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    client.serviceListing.findFirst({
      where: { providerId, isActive: true, category: { isActive: true } },
      orderBy: { startingPrice: 'asc' },
      select: { startingPrice: true },
    }),
  ]);

  const reviewCount = aggregate._count._all;
  const ratingAvg = aggregate._avg.rating ?? 0;
  const ratingScore =
    (ratingAvg * reviewCount + RATING_PRIOR_MEAN * RATING_PRIOR_COUNT) / (reviewCount + RATING_PRIOR_COUNT);

  const profile = await client.providerProfile.update({
    where: { id: providerId },
    data: {
      ratingAvg,
      reviewCount,
      ratingScore,
      minStartingPrice: cheapest?.startingPrice ?? null,
    },
  });

  return { reviewCount, ratingAvg, ratingScore, minStartingPrice: profile.minStartingPrice };
}

export async function countCompletedJobs(providerId: string): Promise<number> {
  return prisma.serviceRequest.count({
    where: { assignedProviderId: providerId, status: 'COMPLETED' },
  });
}

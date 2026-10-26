import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { expandRelatedLocationIds } from './locations';

export interface ProviderMatchContext {
  providerId: string;
  approved: boolean;
  categoryIds: Set<string>;
  locationScope: Set<string>;
}

export async function loadProviderMatchContext(providerId: string): Promise<ProviderMatchContext | null> {
  const provider = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      approvalStatus: true,
      user: { select: { accountStatus: true, role: true } },
      listings: {
        where: { isActive: true, category: { isActive: true } },
        select: { categoryId: true },
      },
      serviceAreas: {
        where: { location: { isActive: true } },
        select: { locationId: true },
      },
    },
  });
  if (!provider) return null;

  const locationScope = await expandRelatedLocationIds(provider.serviceAreas.map((area) => area.locationId));

  return {
    providerId,
    approved:
      provider.approvalStatus === 'APPROVED' &&
      provider.user.accountStatus === 'ACTIVE' &&
      provider.user.role === 'PROVIDER',
    categoryIds: new Set(provider.listings.map((listing) => listing.categoryId)),
    locationScope,
  };
}

interface RequestMatchTarget {
  categoryId: string;
  locationId: string;
  status: string;
  targetProviderId: string | null;
  assignedProviderId: string | null;
}

export interface ProviderRequestAccess {
  allowed: boolean;
  canQuote: boolean;
  isAssigned: boolean;
  isTarget: boolean;
  hasQuote: boolean;
}

export async function getProviderRequestAccess(
  providerId: string,
  request: RequestMatchTarget,
  hasQuote: boolean,
): Promise<ProviderRequestAccess> {
  const context = await loadProviderMatchContext(providerId);
  if (!context) {
    return { allowed: false, canQuote: false, isAssigned: false, isTarget: false, hasQuote };
  }

  const isAssigned = request.assignedProviderId === providerId;
  const isTarget = request.targetProviderId === providerId;
  const statusOpen = ['PENDING', 'RESPONDED'].includes(request.status);
  const targetMatches = !request.targetProviderId || isTarget;
  const categoryMatches = context.categoryIds.has(request.categoryId);
  const locationMatches = context.locationScope.has(request.locationId);

  const canQuote =
    context.approved && statusOpen && targetMatches && categoryMatches && locationMatches && !hasQuote;

  return {
    allowed: isAssigned || isTarget || hasQuote || canQuote,
    canQuote,
    isAssigned,
    isTarget,
    hasQuote,
  };
}

export function openRequestWhereForProvider(
  context: ProviderMatchContext,
  providerId: string,
): Prisma.ServiceRequestWhereInput {
  return {
    status: { in: ['PENDING', 'RESPONDED'] },
    categoryId: { in: [...context.categoryIds] },
    locationId: { in: [...context.locationScope] },
    OR: [{ targetProviderId: null }, { targetProviderId: providerId }],
    quotes: { none: { providerId } },
  };
}

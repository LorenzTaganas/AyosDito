import type {
  Category,
  Location,
  PortfolioImage,
  ProviderProfile,
  ProviderVerification,
  Quote,
  Review,
  ServiceListing,
  ServiceRequest,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import type {
  AdminProviderDto,
  AuthUser,
  CategoryRef,
  LocationRef,
  PortfolioImageDto,
  ProviderDetail,
  ProviderSelf,
  ProviderSummary,
  ProviderVerificationDto,
  QuoteDto,
  RequestPermissions,
  ReviewDto,
  ServiceListingDto,
  ServiceRequestDetail,
  ServiceRequestSummary,
} from '../../../shared/api-types';
import type { QuoteStatus, RequestStatus } from '../../../shared/contracts';
import type { SessionUser } from '../middleware/session';

const ROUNDING = 10;

function round1(value: number): number {
  return Math.round(value * ROUNDING) / ROUNDING;
}

export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export function toCategoryRef(category: Category): CategoryRef {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
  };
}

export function toLocationRef(location: Location & { parent?: Location | null }): LocationRef {
  return {
    id: location.id,
    name: location.name,
    locationType: location.locationType as LocationRef['locationType'],
    parentName: location.parent?.name ?? null,
  };
}

export function toListing(listing: ServiceListing & { category: Category }): ServiceListingDto {
  return {
    id: listing.id,
    categoryId: listing.categoryId,
    category: toCategoryRef(listing.category),
    title: listing.title,
    description: listing.description,
    startingPrice: listing.startingPrice,
    diagnosticFee: listing.diagnosticFee,
    priceType: listing.priceType as ServiceListingDto['priceType'],
    requiresInspection: listing.requiresInspection,
    isActive: listing.isActive,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export function toReview(review: Review & { customer: { fullName: string } }): ReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
    customerDisplayName: shortName(review.customer.fullName),
    providerResponse: review.providerResponse,
    providerRespondedAt: review.providerRespondedAt?.toISOString() ?? null,
  };
}

export function toPortfolioImage(image: PortfolioImage): PortfolioImageDto {
  return {
    id: image.id,
    imageUrl: image.imageUrl,
    caption: image.caption,
    createdAt: image.createdAt.toISOString(),
  };
}

type ProviderBase = Pick<
  ProviderProfile,
  | 'id'
  | 'businessName'
  | 'description'
  | 'profileImage'
  | 'yearsOfExperience'
  | 'verificationStatus'
  | 'identityVerifiedAt'
  | 'businessVerifiedAt'
  | 'ratingAvg'
  | 'reviewCount'
  | 'minStartingPrice'
  | 'isDemo'
  | 'createdAt'
>;

type AreaWithLocation = { location: Location & { parent?: Location | null } };
type ListingWithCategory = ServiceListing & { category: Category };

export function toProviderSummary(
  provider: ProviderBase,
  listings: ListingWithCategory[],
  serviceAreas: AreaWithLocation[],
): ProviderSummary {
  const categories = new Map<string, Category>();
  for (const listing of listings) {
    if (listing.isActive && listing.category.isActive) {
      categories.set(listing.category.id, listing.category);
    }
  }
  const categoryRefs = [...categories.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(toCategoryRef);

  const areaMap = new Map<string, AreaWithLocation['location']>();
  for (const area of serviceAreas) {
    if (area.location.isActive) areaMap.set(area.location.id, area.location);
  }
  const areas = [...areaMap.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((location) => toLocationRef(location));

  return {
    id: provider.id,
    businessName: provider.businessName,
    description: provider.description,
    profileImage: provider.profileImage,
    yearsOfExperience: provider.yearsOfExperience,
    verificationStatus: provider.verificationStatus as ProviderSummary['verificationStatus'],
    identityVerified: Boolean(provider.identityVerifiedAt),
    businessVerified: Boolean(provider.businessVerifiedAt),
    ratingAvg: round1(provider.ratingAvg),
    reviewCount: provider.reviewCount,
    minStartingPrice: provider.minStartingPrice,
    isDemo: provider.isDemo,
    categories: categoryRefs,
    serviceAreas: areas,
    createdAt: provider.createdAt.toISOString(),
  };
}

export const providerCardInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      emailVerifiedAt: true,
      accountStatus: true,
      role: true,
      isDemo: true,
    },
  },
  listings: {
    where: { isActive: true },
    include: { category: true },
    orderBy: [{ startingPrice: 'asc' as const }],
  },
  serviceAreas: {
    include: { location: { include: { parent: true } } },
  },
} satisfies Prisma.ProviderProfileInclude;

export type ProviderCardRow = Prisma.ProviderProfileGetPayload<{ include: typeof providerCardInclude }>;

export const providerDetailInclude = {
  ...providerCardInclude,
  portfolioImages: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ProviderProfileInclude;

export type ProviderDetailRow = Prisma.ProviderProfileGetPayload<{ include: typeof providerDetailInclude }>;

export function toProviderDetail(
  provider: ProviderDetailRow,
  extras: { recentReviews: ReviewDto[]; completedJobs: number; isFavorite: boolean },
): ProviderDetail {
  return {
    ...toProviderSummary(provider, provider.listings, provider.serviceAreas),
    listings: provider.listings.map(toListing),
    portfolioImages: provider.portfolioImages.map(toPortfolioImage),
    recentReviews: extras.recentReviews,
    completedJobs: extras.completedJobs,
    memberSince: provider.createdAt.toISOString(),
    isFavorite: extras.isFavorite,
  };
}

export const providerSelfInclude = {
  ...providerCardInclude,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      emailVerifiedAt: true,
      accountStatus: true,
      role: true,
      isDemo: true,
    },
  },
  listings: {
    include: { category: true },
    orderBy: [{ isActive: 'desc' as const }, { createdAt: 'desc' as const }],
  },
  portfolioImages: { orderBy: { createdAt: 'asc' as const } },
  verifications: {
    orderBy: { createdAt: 'desc' as const },
    include: { reviewedBy: { select: { fullName: true } } },
  },
} satisfies Prisma.ProviderProfileInclude;

export type ProviderSelfRow = Prisma.ProviderProfileGetPayload<{ include: typeof providerSelfInclude }>;

export function toVerification(
  verification: ProviderVerification & { reviewedBy?: { fullName: string } | null },
): ProviderVerificationDto {
  return {
    id: verification.id,
    verificationType: verification.verificationType as ProviderVerificationDto['verificationType'],
    status: verification.status as ProviderVerificationDto['status'],
    note: verification.note,
    reviewNote: verification.reviewNote,
    reviewedAt: verification.reviewedAt?.toISOString() ?? null,
    reviewedByName: verification.reviewedBy?.fullName ?? null,
    createdAt: verification.createdAt.toISOString(),
  };
}

export function toProviderSelf(provider: ProviderSelfRow, completedJobs: number): ProviderSelf {
  return {
    ...toProviderSummary(provider, provider.listings, provider.serviceAreas),
    approvalStatus: provider.approvalStatus as ProviderSelf['approvalStatus'],
    rejectionReason: provider.rejectionReason,
    listings: provider.listings.map(toListing),
    portfolioImages: provider.portfolioImages.map(toPortfolioImage),
    verificationRequests: provider.verifications.map(toVerification),
    completedJobs,
    user: {
      id: provider.user.id,
      fullName: provider.user.fullName,
      email: provider.user.email,
      emailVerified: Boolean(provider.user.emailVerifiedAt),
      isDemo: provider.user.isDemo,
    },
  };
}

export function toAdminProvider(provider: ProviderCardRow): AdminProviderDto {
  return {
    ...toProviderSummary(provider, provider.listings, provider.serviceAreas),
    approvalStatus: provider.approvalStatus as AdminProviderDto['approvalStatus'],
    rejectionReason: provider.rejectionReason,
    user: {
      id: provider.user.id,
      fullName: provider.user.fullName,
      email: provider.user.email,
      accountStatus: provider.user.accountStatus as AdminProviderDto['user']['accountStatus'],
      emailVerified: Boolean(provider.user.emailVerifiedAt),
    },
  };
}

export function toAuthUser(user: SessionUser): AuthUser {
  const provider =
    user.role === 'PROVIDER' && user.providerProfile
      ? {
          id: user.providerProfile.id,
          businessName: user.providerProfile.businessName,
          approvalStatus: user.providerProfile
            .approvalStatus as NonNullable<AuthUser['provider']>['approvalStatus'],
          verificationStatus: user.providerProfile
            .verificationStatus as NonNullable<AuthUser['provider']>['verificationStatus'],
          identityVerified: Boolean(user.providerProfile.identityVerifiedAt),
          businessVerified: Boolean(user.providerProfile.businessVerifiedAt),
          profileImage: user.providerProfile.profileImage,
        }
      : null;

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role as AuthUser['role'],
    accountStatus: user.accountStatus as AuthUser['accountStatus'],
    emailVerified: Boolean(user.emailVerifiedAt),
    isDemo: user.isDemo,
    createdAt: user.createdAt.toISOString(),
    preferredLocationId: user.customerProfile?.preferredLocationId ?? null,
    provider,
  };
}

type QuoteProvider = Pick<
  ProviderProfile,
  | 'id'
  | 'businessName'
  | 'profileImage'
  | 'identityVerifiedAt'
  | 'businessVerifiedAt'
  | 'isDemo'
  | 'ratingAvg'
  | 'reviewCount'
>;

export function toQuote(quote: Quote & { provider: QuoteProvider }): QuoteDto {
  return {
    id: quote.id,
    serviceRequestId: quote.serviceRequestId,
    provider: {
      id: quote.provider.id,
      businessName: quote.provider.businessName,
      profileImage: quote.provider.profileImage,
      identityVerified: Boolean(quote.provider.identityVerifiedAt),
      businessVerified: Boolean(quote.provider.businessVerifiedAt),
      isDemo: quote.provider.isDemo,
      ratingAvg: round1(quote.provider.ratingAvg),
      reviewCount: quote.provider.reviewCount,
    },
    proposedPrice: quote.proposedPrice,
    priceNotes: quote.priceNotes,
    estimatedDuration: quote.estimatedDuration,
    status: quote.status as QuoteStatus,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
  };
}

export const quoteProviderSelect = {
  id: true,
  businessName: true,
  profileImage: true,
  identityVerifiedAt: true,
  businessVerifiedAt: true,
  isDemo: true,
  ratingAvg: true,
  reviewCount: true,
} satisfies Prisma.ProviderProfileSelect;

export const requestSummaryInclude = {
  category: true,
  location: { include: { parent: true } },
  targetProvider: { select: { id: true, businessName: true } },
  assignedProvider: {
    select: {
      id: true,
      businessName: true,
      profileImage: true,
      identityVerifiedAt: true,
      businessVerifiedAt: true,
      isDemo: true,
    },
  },
  customer: { select: { fullName: true } },
  quotes: { select: { id: true, providerId: true, status: true } },
} satisfies Prisma.ServiceRequestInclude;

export type RequestSummaryRow = Prisma.ServiceRequestGetPayload<{ include: typeof requestSummaryInclude }>;

export function toRequestSummary(row: RequestSummaryRow, viewerProviderId: string | null = null): ServiceRequestSummary {
  const myQuote = viewerProviderId ? row.quotes.find((quote) => quote.providerId === viewerProviderId) : undefined;
  return {
    id: row.id,
    title: row.title,
    status: row.status as RequestStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    category: toCategoryRef(row.category),
    location: toLocationRef(row.location),
    targetProvider: row.targetProvider,
    assignedProvider: row.assignedProvider
      ? {
          ...row.assignedProvider,
          identityVerified: Boolean(row.assignedProvider.identityVerifiedAt),
          businessVerified: Boolean(row.assignedProvider.businessVerifiedAt),
          contactEmail: null,
        }
      : null,
    customerDisplayName: shortName(row.customer.fullName),
    quoteCount: viewerProviderId ? (myQuote ? 1 : 0) : row.quotes.length,
    myQuoteStatus: (myQuote?.status as QuoteStatus | undefined) ?? null,
  };
}

export const requestDetailInclude = {
  category: true,
  location: { include: { parent: true } },
  customer: { select: { id: true, fullName: true, email: true } },
  targetProvider: { select: { id: true, businessName: true } },
  assignedProvider: {
    include: { user: { select: { email: true } } },
  },
  quotes: {
    include: { provider: { select: quoteProviderSelect } },
    orderBy: [{ createdAt: 'asc' as const }],
  },
  review: { include: { customer: { select: { fullName: true } } } },
} satisfies Prisma.ServiceRequestInclude;

export type RequestDetailRow = Prisma.ServiceRequestGetPayload<{ include: typeof requestDetailInclude }>;

export interface RequestViewer {
  userId: string;
  role: string;
  providerId: string | null;
  providerCanQuote: boolean;
}

const CONTACT_VISIBLE_STATUSES = new Set(['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);

export function toRequestDetail(row: RequestDetailRow, viewer: RequestViewer): ServiceRequestDetail {
  const isOwner = row.customerId === viewer.userId;
  const isAssignedProvider = Boolean(viewer.providerId && row.assignedProviderId === viewer.providerId);
  const contactUnlocked = CONTACT_VISIBLE_STATUSES.has(row.status);
  const myQuote = viewer.providerId ? row.quotes.find((quote) => quote.providerId === viewer.providerId) : undefined;
  const pendingQuotes = row.quotes.filter((quote) => quote.status === 'PENDING');
  const canSeeFullCustomer = isOwner || (isAssignedProvider && contactUnlocked);
  const canSeeCustomerContact = isOwner || (isAssignedProvider && contactUnlocked);

  const visibleQuotes =
    isOwner || viewer.role === 'ADMIN'
      ? row.quotes
      : viewer.providerId
        ? row.quotes.filter((quote) => quote.providerId === viewer.providerId)
        : [];

  const review = row.review && row.review.moderationStatus === 'VISIBLE' ? toReview(row.review) : null;

  const permissions: RequestPermissions = {
    canCancel: isOwner && ['PENDING', 'RESPONDED', 'ACCEPTED'].includes(row.status),
    canAcceptQuotes: isOwner && row.status === 'RESPONDED' && pendingQuotes.length > 0,
    canDeclineQuotes: isOwner && row.status === 'RESPONDED' && pendingQuotes.length > 0,
    canStartJob: isAssignedProvider && row.status === 'ACCEPTED',
    canCompleteJob: isAssignedProvider && row.status === 'IN_PROGRESS',
    canQuote:
      viewer.role === 'PROVIDER' &&
      viewer.providerCanQuote &&
      ['PENDING', 'RESPONDED'].includes(row.status) &&
      !myQuote,
    canReview: isOwner && row.status === 'COMPLETED' && !row.review,
    hasQuoted: Boolean(myQuote),
  };

  return {
    id: row.id,
    title: row.title,
    problemDescription: row.problemDescription,
    status: row.status as RequestStatus,
    preferredSchedule: row.preferredSchedule,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    category: toCategoryRef(row.category),
    location: toLocationRef(row.location),
    customer: {
      displayName: canSeeFullCustomer ? row.customer.fullName : shortName(row.customer.fullName),
      contactEmail: canSeeCustomerContact ? row.customer.email : null,
    },
    targetProvider: row.targetProvider,
    assignedProvider: row.assignedProvider
      ? {
          id: row.assignedProvider.id,
          businessName: row.assignedProvider.businessName,
          profileImage: row.assignedProvider.profileImage,
          identityVerified: Boolean(row.assignedProvider.identityVerifiedAt),
          businessVerified: Boolean(row.assignedProvider.businessVerifiedAt),
          isDemo: row.assignedProvider.isDemo,
          contactEmail: isOwner && contactUnlocked ? row.assignedProvider.user.email : null,
        }
      : null,
    quotes: visibleQuotes.map(toQuote),
    review,
    permissions,
  };
}

export function parseAuditMetadata(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

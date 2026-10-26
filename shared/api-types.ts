import type {
  AccountStatus,
  LocationType,
  PriceType,
  ProviderApprovalStatus,
  QuoteStatus,
  ReportEntityType,
  ReportReason,
  ReportStatus,
  RequestStatus,
  ReviewModerationStatus,
  Role,
  VerificationReviewStatus,
  VerificationStatus,
  VerificationType,
} from './contracts';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  includesDemoData?: boolean;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: PageMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
  icon: string;
}

export interface CategoryDto extends CategoryRef {
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  providerCount: number;
}

export interface LocationDto {
  id: string;
  name: string;
  locationType: LocationType;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
}

export interface LocationRef {
  id: string;
  name: string;
  locationType: LocationType;
  parentName: string | null;
}

export interface ServiceListingDto {
  id: string;
  categoryId: string;
  category: CategoryRef;
  title: string;
  description: string | null;
  startingPrice: number;
  diagnosticFee: number | null;
  priceType: PriceType;
  requiresInspection: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioImageDto {
  id: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
}

export interface FavoriteDto {
  id: string;
  createdAt: string;
}

export interface ReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerDisplayName: string;
  providerResponse: string | null;
  providerRespondedAt: string | null;
}

export interface ProviderSummary {
  id: string;
  businessName: string;
  description: string;
  profileImage: string | null;
  yearsOfExperience: number | null;
  verificationStatus: VerificationStatus;
  identityVerified: boolean;
  businessVerified: boolean;
  ratingAvg: number;
  reviewCount: number;
  minStartingPrice: number | null;
  isDemo: boolean;
  categories: CategoryRef[];
  serviceAreas: LocationRef[];
  createdAt: string;
}

export interface ProviderDetail extends ProviderSummary {
  listings: ServiceListingDto[];
  portfolioImages: PortfolioImageDto[];
  recentReviews: ReviewDto[];
  completedJobs: number;
  memberSince: string;
  isFavorite: boolean;
}

export interface ProviderUserInfo {
  id: string;
  fullName: string;
  email: string;
  emailVerified: boolean;
  isDemo: boolean;
}

export interface ProviderVerificationDto {
  id: string;
  verificationType: VerificationType;
  status: VerificationReviewStatus;
  note: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  createdAt: string;
}

export interface ProviderSelf extends ProviderSummary {
  approvalStatus: ProviderApprovalStatus;
  rejectionReason: string | null;
  listings: ServiceListingDto[];
  portfolioImages: PortfolioImageDto[];
  verificationRequests: ProviderVerificationDto[];
  completedJobs: number;
  user: ProviderUserInfo;
}

export interface QuoteProviderRef {
  id: string;
  businessName: string;
  profileImage: string | null;
  identityVerified: boolean;
  businessVerified: boolean;
  isDemo: boolean;
  ratingAvg: number;
  reviewCount: number;
}

export interface QuoteDto {
  id: string;
  serviceRequestId: string;
  provider: QuoteProviderRef;
  proposedPrice: number;
  priceNotes: string | null;
  estimatedDuration: string | null;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RequestCustomerView {
  displayName: string;
  contactEmail: string | null;
}

export interface AssignedProviderRef {
  id: string;
  businessName: string;
  profileImage: string | null;
  identityVerified: boolean;
  businessVerified: boolean;
  isDemo: boolean;
  contactEmail: string | null;
}

export interface ServiceRequestSummary {
  id: string;
  title: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  category: CategoryRef;
  location: LocationRef;
  targetProvider: { id: string; businessName: string } | null;
  assignedProvider: AssignedProviderRef | null;
  customerDisplayName: string;
  quoteCount: number;
  myQuoteStatus: QuoteStatus | null;
}

export interface RequestPermissions {
  canCancel: boolean;
  canAcceptQuotes: boolean;
  canDeclineQuotes: boolean;
  canStartJob: boolean;
  canCompleteJob: boolean;
  canQuote: boolean;
  canReview: boolean;
  hasQuoted: boolean;
}

export interface ServiceRequestDetail {
  id: string;
  title: string;
  problemDescription: string;
  status: RequestStatus;
  preferredSchedule: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  category: CategoryRef;
  location: LocationRef;
  customer: RequestCustomerView;
  targetProvider: { id: string; businessName: string } | null;
  assignedProvider: AssignedProviderRef | null;
  quotes: QuoteDto[];
  review: ReviewDto | null;
  permissions: RequestPermissions;
}

export interface CustomerDashboardDto {
  counts: {
    open: number;
    active: number;
    completed: number;
    total: number;
  };
  quotesToReview: number;
  favorites: number;
  recentRequests: ServiceRequestSummary[];
}

export interface ProviderDashboardDto {
  counts: {
    newOpportunities: number;
    activeJobs: number;
    completedJobs: number;
    pendingQuotes: number;
    reviewCount: number;
  };
  profile: {
    approvalStatus: ProviderApprovalStatus;
    verificationStatus: VerificationStatus;
    completeness: number;
    missing: string[];
  };
  recentRequests: ServiceRequestSummary[];
  recentReviews: ReviewDto[];
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  isDemo: boolean;
  createdAt: string;
  preferredLocationId: string | null;
  provider: {
    id: string;
    businessName: string;
    approvalStatus: ProviderApprovalStatus;
    verificationStatus: VerificationStatus;
    identityVerified: boolean;
    businessVerified: boolean;
    profileImage: string | null;
  } | null;
}

export interface MeResponse {
  user: AuthUser | null;
}

export interface CsrfTokenResponse {
  token: string;
}

export interface AuthResponse {
  user: AuthUser;
}

export interface RegistrationResponse {
  user: AuthUser;
  /** Development only: safe to display so the flow can be tested without SMTP. */
  devVerificationUrl?: string;
}

export interface ForgotPasswordResponse {
  message: string;
  /** Development only: safe to display so the flow can be tested without SMTP. */
  devResetUrl?: string;
}

export interface MessageResponse {
  message: string;
}

export interface ResendVerificationResponse extends MessageResponse {
  devVerificationUrl?: string;
}

// ---------------------------------------------------------------------------
// Admin DTOs
// ---------------------------------------------------------------------------

export interface AdminUserDto {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  isDemo: boolean;
  createdAt: string;
  provider: {
    id: string;
    businessName: string;
    approvalStatus: ProviderApprovalStatus;
    verificationStatus: VerificationStatus;
  } | null;
}

export interface AdminProviderDto extends ProviderSummary {
  approvalStatus: ProviderApprovalStatus;
  rejectionReason: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    accountStatus: AccountStatus;
    emailVerified: boolean;
  };
}

export interface AdminVerificationDto {
  id: string;
  verificationType: VerificationType;
  status: VerificationReviewStatus;
  note: string;
  reviewNote: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
  provider: {
    id: string;
    businessName: string;
    approvalStatus: ProviderApprovalStatus;
  };
}

export interface AdminReviewDto {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  moderationStatus: ReviewModerationStatus;
  providerResponse: string | null;
  author: {
    id: string;
    displayName: string;
    email: string;
    isDemo: boolean;
  };
  provider: {
    id: string;
    businessName: string;
  };
}

export interface ReportTargetPreview {
  label: string;
  detail: string | null;
}

export interface AdminReportDto {
  id: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  reporter: {
    id: string;
    fullName: string;
    email: string;
  };
  reviewedBy: { id: string; fullName: string } | null;
  reviewedAt: string | null;
  targetPreview: ReportTargetPreview | null;
}

export interface AuditLogDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; fullName: string; email: string } | null;
}

export interface AdminCategoryDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  isActive: boolean;
  sortOrder: number;
  listingCount: number;
  requestCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLocationDto {
  id: string;
  name: string;
  locationType: LocationType;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  childCount: number;
  serviceAreaCount: number;
  requestCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCreatedDto {
  id: string;
  status: ReportStatus;
  createdAt: string;
}

export interface AdminDashboardDto {
  counts: {
    users: number;
    customers: number;
    providers: number;
    admins: number;
    suspendedUsers: number;
    pendingProviders: number;
    approvedProviders: number;
    openRequests: number;
    activeJobs: number;
    completedRequests: number;
    visibleReviews: number;
    openReports: number;
  };
  requestsByStatus: Record<RequestStatus, number>;
  pendingProviders: AdminProviderDto[];
  openReports: AdminReportDto[];
  recentAudit: AuditLogDto[];
}

export interface ProviderSearchResponse {
  data: ProviderSummary[];
  meta: PageMeta;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

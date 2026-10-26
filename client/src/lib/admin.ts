import type {
  AccountStatus,
  LocationType,
  ProviderApprovalStatus,
  ReportEntityType,
  ReportStatus,
  ReviewModerationStatus,
  Role,
  VerificationReviewStatus,
  VerificationStatus,
} from '@shared/contracts';

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Customer',
  PROVIDER: 'Provider',
  ADMIN: 'Administrator',
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
};

export const PROVIDER_APPROVAL_LABELS: Record<ProviderApprovalStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: 'Not verified',
  IDENTITY_VERIFIED: 'Identity verified',
  BUSINESS_VERIFIED: 'Business verified',
};

export const VERIFICATION_REVIEW_LABELS: Record<VerificationReviewStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: 'Open',
  RESOLVED: 'Resolved',
  DISMISSED: 'Dismissed',
};

export const REPORT_ENTITY_LABELS: Record<ReportEntityType, string> = {
  PROVIDER: 'Provider report',
  REVIEW: 'Review report',
};

export const MODERATION_STATUS_LABELS: Record<ReviewModerationStatus, string> = {
  VISIBLE: 'Visible',
  HIDDEN: 'Hidden',
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  REGION: 'Region',
  PROVINCE: 'Province',
  CITY: 'City',
  BARANGAY: 'Barangay',
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'user.status_changed': 'Account status changed',
  'user.admin_granted': 'Administrator access granted',
  'provider.approved': 'Provider application approved',
  'provider.rejected': 'Provider application rejected',
  'verification.approved': 'Verification approved',
  'verification.rejected': 'Verification rejected',
  'review.moderated': 'Review moderation changed',
  'report.resolved': 'Report closed',
  'category.created': 'Category created',
  'category.updated': 'Category updated',
  'location.created': 'Location created',
  'location.updated': 'Location updated',
};

export function auditActionLabel(action: string): string {
  const known = AUDIT_ACTION_LABELS[action];
  if (known) return known;
  const words = action.replace(/[._]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const LOCATION_PARENT_TYPES: Record<LocationType, LocationType[]> = {
  REGION: [],
  PROVINCE: ['REGION'],
  CITY: ['REGION', 'PROVINCE'],
  BARANGAY: ['CITY'],
};

export function parseAdminFilter<T extends string>(value: string | null, allowed: readonly T[]): T | 'ALL' {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : 'ALL';
}

export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

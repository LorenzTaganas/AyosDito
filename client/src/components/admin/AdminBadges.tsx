import type {
  AccountStatus,
  ProviderApprovalStatus,
  ReportEntityType,
  ReportStatus,
  ReviewModerationStatus,
  Role,
  VerificationReviewStatus,
  VerificationStatus,
} from '@shared/contracts';
import { Badge } from '@/components/ui/Badge';
import {
  ACCOUNT_STATUS_LABELS,
  MODERATION_STATUS_LABELS,
  PROVIDER_APPROVAL_LABELS,
  REPORT_ENTITY_LABELS,
  REPORT_STATUS_LABELS,
  ROLE_LABELS,
  VERIFICATION_REVIEW_LABELS,
  VERIFICATION_STATUS_LABELS,
} from '@/lib/admin';

export function RoleBadge({ role }: { role: Role }) {
  const variant = role === 'ADMIN' ? 'brand' : role === 'PROVIDER' ? 'sky' : 'neutral';
  return <Badge variant={variant}>{ROLE_LABELS[role]}</Badge>;
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge variant={status === 'SUSPENDED' ? 'danger' : 'brand'}>
      {ACCOUNT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ApprovalStatusBadge({ status }: { status: ProviderApprovalStatus }) {
  const variant = status === 'APPROVED' ? 'brand' : status === 'REJECTED' ? 'danger' : 'sun';
  return <Badge variant={variant}>{PROVIDER_APPROVAL_LABELS[status]}</Badge>;
}

export function VerificationStatusBadge({ status }: { status: VerificationStatus }) {
  const variant =
    status === 'BUSINESS_VERIFIED' ? 'brand' : status === 'IDENTITY_VERIFIED' ? 'sky' : 'outline';
  return <Badge variant={variant}>{VERIFICATION_STATUS_LABELS[status]}</Badge>;
}

export function VerificationReviewBadge({ status }: { status: VerificationReviewStatus }) {
  const variant = status === 'APPROVED' ? 'brand' : status === 'REJECTED' ? 'danger' : 'sun';
  return <Badge variant={variant}>{VERIFICATION_REVIEW_LABELS[status]}</Badge>;
}

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const variant = status === 'OPEN' ? 'sun' : status === 'RESOLVED' ? 'brand' : 'neutral';
  return <Badge variant={variant}>{REPORT_STATUS_LABELS[status]}</Badge>;
}

export function ReportEntityBadge({ entityType }: { entityType: ReportEntityType }) {
  return <Badge variant="outline">{REPORT_ENTITY_LABELS[entityType]}</Badge>;
}

export function ModerationStatusBadge({ status }: { status: ReviewModerationStatus }) {
  return (
    <Badge variant={status === 'VISIBLE' ? 'brand' : 'danger'}>
      {MODERATION_STATUS_LABELS[status]}
    </Badge>
  );
}

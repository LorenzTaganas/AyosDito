import type { QuoteStatus, RequestStatus } from '@shared/contracts';
import { QUOTE_STATUS_LABELS, REQUEST_STATUS_LABELS } from '@shared/contracts';
import { StatusBadge } from '../components/ui/Verification';

export function requestStatusTone(status: RequestStatus): 'neutral' | 'brand' | 'sun' | 'sky' | 'danger' {
  switch (status) {
    case 'PENDING':
      return 'neutral';
    case 'RESPONDED':
      return 'sky';
    case 'ACCEPTED':
    case 'COMPLETED':
      return 'brand';
    case 'IN_PROGRESS':
      return 'sun';
    case 'CANCELLED':
      return 'neutral';
    case 'DECLINED':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <StatusBadge label={REQUEST_STATUS_LABELS[status]} tone={requestStatusTone(status)} />;
}

export function quoteStatusTone(status: QuoteStatus): 'neutral' | 'brand' | 'sun' | 'sky' | 'danger' {
  if (status === 'ACCEPTED') return 'brand';
  if (status === 'DECLINED') return 'danger';
  return 'sun';
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <StatusBadge label={QUOTE_STATUS_LABELS[status]} tone={quoteStatusTone(status)} />;
}

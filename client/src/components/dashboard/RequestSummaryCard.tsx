import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin, UserRound } from 'lucide-react';
import type { ServiceRequestSummary } from '@shared/api-types';
import { formatDate, locationLabel } from '@/lib/format';
import { QuoteStatusBadge, RequestStatusBadge } from '@/lib/status';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Verification';

export function RequestSummaryCard({
  request,
  perspective,
  href,
}: {
  request: ServiceRequestSummary;
  perspective: 'customer' | 'provider';
  href: string;
}) {
  const assigned = request.assignedProvider;
  const target = request.targetProvider;

  return (
    <article className="card-surface p-4 transition hover:border-brand-200 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-snug sm:text-base">
            <Link to={href} className="rounded-sm hover:text-brand-800">
              {request.title}
            </Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-mute">
            <span className="font-semibold text-ink-soft">{request.category.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {locationLabel(request.location)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Updated {formatDate(request.updatedAt)}
            </span>
          </p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        {perspective === 'customer' ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
              {assigned ? (
                <>
                  <span className="font-semibold">{assigned.businessName}</span>
                  {assigned.isDemo ? <DemoBadge label="Demo" /> : null}
                </>
              ) : target ? (
                <>Sent to <span className="font-semibold">{target.businessName}</span></>
              ) : (
                <>Shared with matching providers</>
              )}
            </span>
            <span aria-hidden="true">·</span>
            <Badge variant={request.quoteCount > 0 ? 'sky' : 'outline'}>
              {request.quoteCount} {request.quoteCount === 1 ? 'quote' : 'quotes'}
            </Badge>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
              Customer <span className="font-semibold">{request.customerDisplayName}</span>
            </span>
            {request.myQuoteStatus ? (
              <>
                <span aria-hidden="true">·</span>
                <QuoteStatusBadge status={request.myQuoteStatus} />
              </>
            ) : (
              <>
                <span aria-hidden="true">·</span>
                <Badge variant="outline">{target ? 'Direct request' : 'Open request'}</Badge>
              </>
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex justify-end border-t border-line/80 pt-3">
        <Link to={href} className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
          View request
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

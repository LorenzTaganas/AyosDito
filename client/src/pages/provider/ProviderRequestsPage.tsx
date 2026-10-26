import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList,
  FileText,
  Inbox,
  MessageSquareQuote,
  PlusCircle,
  Wrench,
} from 'lucide-react';
import type { ProviderSelf, ServiceRequestSummary } from '@shared/api-types';
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  type RequestStatus,
} from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/Brand';
import { buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { RequestSummaryCard } from '@/components/dashboard/RequestSummaryCard';

type ProviderView = 'opportunities' | 'quotes' | 'jobs';

const VIEWS: Array<{ value: ProviderView; label: string; blurb: string; icon: typeof Inbox }> = [
  {
    value: 'opportunities',
    label: 'Open requests',
    blurb: 'Requests that match an active service and one of your service areas.',
    icon: Inbox,
  },
  {
    value: 'quotes',
    label: 'My quotes',
    blurb: 'Requests where you have submitted a quote, with the customer’s current decision.',
    icon: MessageSquareQuote,
  },
  {
    value: 'jobs',
    label: 'Jobs',
    blurb: 'Requests assigned to you after a customer accepted your quote.',
    icon: ClipboardList,
  },
];

const STATUS_OPTIONS: Record<ProviderView, Array<RequestStatus | 'ALL'>> = {
  opportunities: ['ALL', 'PENDING', 'RESPONDED'],
  quotes: ['ALL', 'PENDING', 'RESPONDED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DECLINED'],
  jobs: ['ALL', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'],
};

function parseView(value: string | null): ProviderView {
  return value === 'quotes' || value === 'jobs' ? value : 'opportunities';
}

export function ProviderRequestsPage() {
  useDocumentTitle('Requests & quotes');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const view = parseView(params.get('view'));
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const rawStatus = params.get('status');
  const status: RequestStatus | 'ALL' =
    rawStatus && (REQUEST_STATUSES as readonly string[]).includes(rawStatus) && STATUS_OPTIONS[view].includes(rawStatus as RequestStatus)
      ? (rawStatus as RequestStatus)
      : 'ALL';

  const self = useQuery({
    queryKey: queryKeys.providerSelf,
    queryFn: () => api.get<ProviderSelf>('/providers/me'),
  });

  const requestsQuery = useQuery({
    queryKey: queryKeys.providerRequests({ view, status, page, pageSize: 10 }),
    queryFn: () =>
      api.list<ServiceRequestSummary>('/providers/me/requests', {
        view,
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize: 10,
      }),
  });

  const provider = self.data;
  const approvalStatus = provider?.approvalStatus ?? user?.provider?.approvalStatus ?? 'PENDING';
  const activeListings = provider?.listings.filter((listing) => listing.isActive) ?? [];
  const hasCoverage = Boolean(provider && provider.serviceAreas.length > 0);
  const matchesUnavailable =
    approvalStatus === 'APPROVED' && (activeListings.length === 0 || !hasCoverage);

  const activeView = VIEWS.find((item) => item.value === view) ?? VIEWS[0];

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
    }
    setParams(next, { replace: true });
  }

  function changeView(nextView: ProviderView) {
    const next = new URLSearchParams();
    if (nextView !== 'opportunities') next.set('view', nextView);
    setParams(next, { replace: true });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Requests & quotes"
        title="Work that matches your business"
        description="Open requests are matched by category, location, and your approved provider profile. Never quote on work you cannot inspect or complete."
        actions={
          <>
            <Link to="/provider/services" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
              <Wrench className="h-4 w-4" aria-hidden="true" />
              Services & areas
            </Link>
            <Link to="/provider/dashboard" className={buttonStyles({ variant: 'primary', size: 'md' })}>
              Provider overview
            </Link>
          </>
        }
      />

      {approvalStatus !== 'APPROVED' ? (
        <Alert
          tone={approvalStatus === 'REJECTED' ? 'error' : 'warning'}
          title={
            approvalStatus === 'REJECTED'
              ? 'Your profile needs changes before you can quote'
              : 'Your profile is waiting for approval'
          }
        >
          <p>
            You can review your existing quotes and jobs here, but new open requests are only shown
            to approved providers, and the server rejects new quotes until approval.{' '}
            <Link to="/provider/profile" className="font-semibold underline underline-offset-2">
              Open profile settings
            </Link>
            .
          </p>
          {provider?.rejectionReason ? (
            <p className="mt-1 rounded-lg bg-white/60 px-3 py-2">
              <strong>Administrator note:</strong> {provider.rejectionReason}
            </p>
          ) : null}
        </Alert>
      ) : null}

      {matchesUnavailable ? (
        <Alert tone="info" title="Your matching profile is incomplete">
          {activeListings.length === 0
            ? 'Add at least one active service listing so open requests can match your category. '
            : ''}
          {!hasCoverage
            ? 'Choose at least one service area so requests in your area can reach you. '
            : ''}
          <Link to="/provider/services" className="font-semibold underline underline-offset-2">
            Update services
          </Link>
          {' · '}
          <Link to="/provider/profile" className="font-semibold underline underline-offset-2">
            Update service areas
          </Link>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Provider request views">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={view === item.value}
                onClick={() => changeView(item.value)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                  view === item.value
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-line bg-paper-soft text-ink-soft hover:border-brand-200 hover:text-ink',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="max-w-md text-xs leading-relaxed text-ink-mute">{activeView.blurb}</p>
      </div>

      {STATUS_OPTIONS[view].length > 1 ? (
        <div className="overflow-x-auto pb-1">
          <div className="flex w-max gap-1.5" role="tablist" aria-label="Filter requests by status">
            {STATUS_OPTIONS[view].map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={status === option}
                onClick={() => updateParams({ status: option === 'ALL' ? null : option })}
                className={cn(
                  'whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                  status === option
                    ? 'border-brand-300 bg-brand-50 text-brand-900'
                    : 'border-line bg-paper-soft text-ink-mute hover:border-brand-200 hover:text-ink',
                )}
              >
                {option === 'ALL' ? 'All statuses' : REQUEST_STATUS_LABELS[option]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {requestsQuery.isPending ? (
        <LoadingBlock label="Loading requests…" />
      ) : requestsQuery.isError ? (
        <ErrorState
          message="We could not load these requests. Check your connection and try again."
          onRetry={() => requestsQuery.refetch()}
        />
      ) : requestsQuery.data.data.length === 0 ? (
        <EmptyState
          icon={
            view === 'opportunities' ? (
              <Inbox className="h-5 w-5" aria-hidden="true" />
            ) : view === 'quotes' ? (
              <FileText className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            )
          }
          title={
            view === 'opportunities'
              ? approvalStatus !== 'APPROVED'
                ? 'No open requests until you are approved'
                : status !== 'ALL'
                  ? `No open requests under “${REQUEST_STATUS_LABELS[status as RequestStatus]}”`
                  : 'No matching open requests right now'
              : view === 'quotes'
                ? status !== 'ALL'
                  ? 'No quotes under that status'
                  : 'You have not sent any quotes yet'
                : status !== 'ALL'
                  ? 'No jobs under that status'
                  : 'No accepted jobs yet'
          }
          description={
            view === 'opportunities'
              ? approvalStatus !== 'APPROVED'
                ? 'An administrator must approve your provider profile before matching requests appear. You can prepare your services and service areas now.'
                : matchesUnavailable
                  ? 'Add an active service listing and at least one service area so matching can include you.'
                  : 'New requests appear when a customer posts work in one of your categories and service areas. Check back later or widen your coverage.'
              : view === 'quotes'
                ? 'Browse open requests with a matching category and service area, then send one clear quotation with what is included.'
                : 'When a customer accepts your quote, the request appears here so you can start and complete the job.'
          }
          action={
            view === 'quotes' ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => changeView('opportunities')}
                  className={buttonStyles({ variant: 'primary', size: 'md' })}
                >
                  Browse open requests
                </button>
                {status !== 'ALL' ? (
                  <button
                    type="button"
                    onClick={() => updateParams({ status: null })}
                    className={buttonStyles({ variant: 'secondary', size: 'md' })}
                  >
                    Show all quotes
                  </button>
                ) : null}
              </div>
            ) : view === 'opportunities' && approvalStatus === 'APPROVED' ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/provider/services" className={buttonStyles({ variant: 'primary', size: 'md' })}>
                  <PlusCircle className="h-4 w-4" aria-hidden="true" />
                  Manage services
                </Link>
                <Link to="/provider/profile" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
                  Set service areas
                </Link>
              </div>
            ) : view === 'jobs' ? (
              <button
                type="button"
                onClick={() => changeView('quotes')}
                className={buttonStyles({ variant: 'secondary', size: 'md' })}
              >
                Review my quotes
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-mute">
              {requestsQuery.data.meta.total}{' '}
              {requestsQuery.data.meta.total === 1 ? 'request' : 'requests'}
              {status !== 'ALL' ? ` · ${REQUEST_STATUS_LABELS[status as RequestStatus]}` : ''}
            </p>
            <Badge variant="outline">{activeView.label}</Badge>
          </div>
          <div className="space-y-3">
            {requestsQuery.data.data.map((request) => (
              <RequestSummaryCard
                key={request.id}
                request={request}
                perspective="provider"
                href={`/provider/requests/${request.id}`}
              />
            ))}
          </div>
          <Pagination
            page={requestsQuery.data.meta.page}
            pageSize={requestsQuery.data.meta.pageSize}
            total={requestsQuery.data.meta.total}
            totalPages={requestsQuery.data.meta.totalPages}
            onPageChange={(nextPage) => {
              updateParams({ page: String(nextPage) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">Customer privacy</p>
        <p className="mt-2">
          Open requests show a shortened customer name. The full name and email stay hidden until
          the customer accepts your quote. Do not ask for unnecessary identity documents, and do not
          move conversations off the platform before an agreement is recorded.
        </p>
      </div>
    </div>
  );
}

import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, PlusCircle } from 'lucide-react';
import type { ServiceRequestSummary } from '@shared/api-types';
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES, type RequestStatus } from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/Brand';
import { Button, buttonStyles } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { RequestSummaryCard } from '@/components/dashboard/RequestSummaryCard';

const TABS: Array<{ value: RequestStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All requests' },
  ...REQUEST_STATUSES.map((status) => ({ value: status, label: REQUEST_STATUS_LABELS[status] })),
];

function parseStatus(value: string | null): RequestStatus | 'ALL' {
  return value && (REQUEST_STATUSES as readonly string[]).includes(value)
    ? (value as RequestStatus)
    : 'ALL';
}

export function CustomerRequestsPage() {
  useDocumentTitle('My requests');
  const [params, setParams] = useSearchParams();
  const status = parseStatus(params.get('status'));
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);

  const requestsQuery = useQuery({
    queryKey: queryKeys.customerRequests({ status, page, pageSize: 10 }),
    queryFn: () =>
      api.list<ServiceRequestSummary>('/requests/me', {
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize: 10,
      }),
  });

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
    }
    setParams(next, { replace: true });
  }

  const activeTab = TABS.find((tab) => tab.value === status) ?? TABS[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Customer requests"
        title="My repair requests"
        description="Every request keeps its own quote history and status. Review quotations carefully before accepting one."
        actions={
          <Link to="/customer/requests/new" className={buttonStyles({ variant: 'primary', size: 'md' })}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            New request
          </Link>
        }
      />

      <div className="overflow-x-auto pb-1">
        <div className="flex w-max gap-1.5" role="tablist" aria-label="Filter requests by status">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => updateParams({ status: tab.value === 'ALL' ? null : tab.value })}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                status === tab.value
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-line bg-paper-soft text-ink-soft hover:border-brand-200 hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {requestsQuery.isPending ? (
        <LoadingBlock label="Loading requests…" />
      ) : requestsQuery.isError ? (
        <ErrorState
          message="We could not load your requests. Check your connection and try again."
          onRetry={() => requestsQuery.refetch()}
        />
      ) : requestsQuery.data.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" aria-hidden="true" />}
          title={status === 'ALL' ? 'No requests yet' : `No requests under “${activeTab.label}”`}
          description={
            status === 'ALL'
              ? 'Post a request to describe the problem and receive quotations from approved providers who cover your area.'
              : 'Try another status filter, or open all requests to see everything you have posted.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/customer/requests/new" className={buttonStyles({ variant: 'primary', size: 'md' })}>
                Post a request
              </Link>
              {status !== 'ALL' ? (
                <Button variant="secondary" onClick={() => updateParams({ status: null })}>
                  Show all requests
                </Button>
              ) : null}
            </div>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-ink-mute">
              {requestsQuery.data.meta.total} {requestsQuery.data.meta.total === 1 ? 'request' : 'requests'}
              {status !== 'ALL' ? ` · ${activeTab.label}` : ''}
            </p>
          </div>
          <div className="space-y-3">
            {requestsQuery.data.data.map((request) => (
              <RequestSummaryCard
                key={request.id}
                request={request}
                perspective="customer"
                href={`/customer/requests/${request.id}`}
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

      <p className="text-xs leading-relaxed text-ink-mute">
        Request details are visible to you and to approved providers who match the category and
        location. Your email address is shared with the provider only after you accept their
        quotation.
      </p>
    </div>
  );
}

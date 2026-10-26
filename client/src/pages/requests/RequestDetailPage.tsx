import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flag,
  Info,
  Lock,
  Mail,
  MapPin,
  MessageSquareQuote,
  Pencil,
  Play,
  ShieldCheck,
  Star,
  UserRound,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { QuoteDto, ReviewDto, ServiceRequestDetail } from '@shared/api-types';
import { REQUEST_STATUS_LABELS } from '@shared/contracts';
import { api, isApiClientError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import {
  formatDate,
  formatDateTime,
  formatPeso,
  locationLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { RequestStatusBadge, QuoteStatusBadge } from '@/lib/status';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Rating } from '@/components/ui/Stars';
import { DemoBadge, VerificationBadges } from '@/components/ui/Verification';
import { ReportDialog } from '@/components/providers/ReportDialog';
import { QuoteFormDialog } from '@/components/requests/QuoteFormDialog';
import { ReviewForm } from '@/components/requests/ReviewForm';

type ActionPayload =
  | { kind: 'accept'; quoteId: string }
  | { kind: 'decline'; quoteId: string }
  | { kind: 'cancel' }
  | { kind: 'status'; status: 'IN_PROGRESS' | 'COMPLETED' };

const PROGRESS_STEPS = ['PENDING', 'RESPONDED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'] as const;

function statusExplanation(status: ServiceRequestDetail['status'], role: 'CUSTOMER' | 'PROVIDER'): string {
  switch (status) {
    case 'PENDING':
      return 'The request is open and waiting for quotations from matching providers.';
    case 'RESPONDED':
      return role === 'CUSTOMER'
        ? 'Quotes are in. Compare the price, scope, and duration before accepting one.'
        : 'The customer is comparing quotes. Your quote stays pending until they decide.';
    case 'ACCEPTED':
      return role === 'CUSTOMER'
        ? 'You accepted a quote. Contact details are now shared with the selected provider.'
        : 'The customer accepted a quote. Contact details are now available to the assigned provider.';
    case 'IN_PROGRESS':
      return 'The assigned provider marked the job as in progress.';
    case 'COMPLETED':
      return 'The job is complete. The customer can leave one review for this request.';
    case 'CANCELLED':
      return 'The customer cancelled this request. Locked contact details are hidden again.';
    case 'DECLINED':
      return 'All quotes for this request were declined, so the request is closed.';
    default:
      return '';
  }
}

export function RequestDetailPage() {
  const { requestId = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [quoteAction, setQuoteAction] = useState<{ type: 'accept' | 'decline'; quote: QuoteDto } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [jobAction, setJobAction] = useState<'IN_PROGRESS' | 'COMPLETED' | null>(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reportProvider, setReportProvider] = useState<{ id: string; name: string } | null>(null);
  const [reportReview, setReportReview] = useState<ReviewDto | null>(null);

  const requestQuery = useQuery({
    queryKey: queryKeys.request(requestId),
    queryFn: () => api.get<ServiceRequestDetail>(`/requests/${requestId}`),
    enabled: Boolean(requestId),
  });

  const request = requestQuery.data;

  useDocumentTitle(request?.title ?? 'Request details');

  const actionMutation = useMutation({
    mutationFn: async (payload: ActionPayload): Promise<ServiceRequestDetail> => {
      if (payload.kind === 'accept') {
        return api.post<ServiceRequestDetail>(`/quotes/${payload.quoteId}/accept`);
      }
      if (payload.kind === 'decline') {
        return api.post<ServiceRequestDetail>(`/quotes/${payload.quoteId}/decline`);
      }
      if (payload.kind === 'cancel') {
        return api.patch<ServiceRequestDetail>(`/requests/${requestId}/cancel`);
      }
      return api.patch<ServiceRequestDetail>(`/requests/${requestId}/status`, { status: payload.status });
    },
    onSuccess: async (data, payload) => {
      queryClient.setQueryData(queryKeys.request(requestId), data);
      setQuoteAction(null);
      setCancelOpen(false);
      setJobAction(null);
      setActionError(null);
      toast.success(
        payload.kind === 'accept'
          ? 'Quote accepted. Contact details are now shared with the provider.'
          : payload.kind === 'decline'
            ? 'Quote declined.'
            : payload.kind === 'cancel'
              ? 'Request cancelled.'
              : payload.status === 'IN_PROGRESS'
                ? 'Job marked in progress.'
                : 'Job marked complete. The customer can now leave a review.',
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.customerDashboard });
      await queryClient.invalidateQueries({ queryKey: ['customer', 'requests'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.providerDashboard });
      await queryClient.invalidateQueries({ queryKey: ['provider', 'requests'] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : 'That action could not be completed.');
    },
  });

  const backTo = user?.role === 'PROVIDER' ? '/provider/requests' : '/customer/requests';

  if (requestQuery.isPending) {
    return (
      <div className="space-y-4">
        <Link to={backTo} className={buttonStyles({ variant: 'ghost', size: 'sm', className: '-ml-2' })}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to requests
        </Link>
        <LoadingBlock label="Loading request…" />
      </div>
    );
  }

  if (requestQuery.isError || !request) {
    const notAllowed =
      isApiClientError(requestQuery.error) &&
      [403, 404].includes(requestQuery.error.status);
    return (
      <div className="space-y-4">
        <Link to={backTo} className={buttonStyles({ variant: 'ghost', size: 'sm', className: '-ml-2' })}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to requests
        </Link>
        <ErrorState
          title={notAllowed ? 'This request is not available to you' : 'We could not load this request'}
          message={
            notAllowed
              ? 'The request may have been removed, or it may be outside your provider categories and service areas. The server hides requests you are not permitted to view.'
              : requestQuery.error instanceof Error
                ? requestQuery.error.message
                : 'Check your connection and try again.'
          }
          onRetry={notAllowed ? undefined : () => requestQuery.refetch()}
        />
      </div>
    );
  }

  if (!user) return null;

  const isCustomer = user.role === 'CUSTOMER';
  const isProvider = user.role === 'PROVIDER';
  const assignedProvider = request.assignedProvider;
  const isAssignedProvider = Boolean(isProvider && assignedProvider && user.provider?.id === assignedProvider.id);
  const providerQuote = isProvider ? (request.quotes[0] ?? null) : null;
  const canEditQuote =
    Boolean(providerQuote) &&
    providerQuote?.status === 'PENDING' &&
    ['PENDING', 'RESPONDED'].includes(request.status);

  const progressIndex = PROGRESS_STEPS.indexOf(request.status as (typeof PROGRESS_STEPS)[number]);

  function openQuoteAction(type: 'accept' | 'decline', quote: QuoteDto) {
    setActionError(null);
    setQuoteAction({ type, quote });
  }

  function runAction(payload: ActionPayload) {
    setActionError(null);
    actionMutation.mutate(payload);
  }

  return (
    <div className="space-y-5">
      <Link to={backTo} className={buttonStyles({ variant: 'ghost', size: 'sm', className: '-ml-2' })}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to requests
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Request details</p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            {request.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-mute">
            <span className="font-semibold text-ink-soft">{request.category.name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {locationLabel(request.location)}
            </span>
            <span aria-hidden="true">·</span>
            <span>Posted {formatDate(request.createdAt)}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <RequestStatusBadge status={request.status} />
          {isProvider && providerQuote ? <QuoteStatusBadge status={providerQuote.status} /> : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="card-surface p-5 sm:p-6" aria-labelledby="problem-heading">
            <h2 id="problem-heading" className="text-base font-extrabold">
              What needs fixing
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
              {request.problemDescription}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4 text-xs">
              <Badge variant="outline">{request.category.name}</Badge>
              <Badge variant="outline">
                <MapPin className="h-3 w-3" aria-hidden="true" /> {locationLabel(request.location)}
              </Badge>
              {request.preferredSchedule ? (
                <Badge variant="outline">
                  <CalendarDays className="h-3 w-3" aria-hidden="true" /> {request.preferredSchedule}
                </Badge>
              ) : null}
            </div>
          </section>

          <section className="card-surface p-5 sm:p-6" aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="text-base font-extrabold">
              Progress
            </h2>
            <div className="mt-4 flex gap-1" aria-hidden="true">
              {PROGRESS_STEPS.map((step, index) => (
                <span
                  key={step}
                  className={cn(
                    'h-1.5 flex-1 rounded-full',
                    progressIndex >= 0 && index <= progressIndex ? 'bg-brand-600' : 'bg-line',
                  )}
                />
              ))}
            </div>
            <p className="mt-3 text-sm font-bold text-ink">{REQUEST_STATUS_LABELS[request.status]}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {statusExplanation(request.status, isCustomer ? 'CUSTOMER' : 'PROVIDER')}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-mute">
              <span>Last updated {formatDateTime(request.updatedAt)}</span>
              {request.completedAt ? <span>Completed {formatDateTime(request.completedAt)}</span> : null}
              {request.cancelledAt ? <span>Cancelled {formatDateTime(request.cancelledAt)}</span> : null}
            </div>
          </section>

          {isCustomer ? (
            <section aria-labelledby="quotes-heading">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="quotes-heading" className="text-lg font-extrabold">
                    Compare quotes
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-mute">
                    Price is only one signal. Read what is included and check whether parts or an
                    inspection could change the total.
                  </p>
                </div>
                <Badge variant="outline">
                  {request.quotes.length} {request.quotes.length === 1 ? 'quote' : 'quotes'}
                </Badge>
              </div>

              {request.quotes.length === 0 ? (
                <EmptyState
                  icon={<MessageSquareQuote className="h-5 w-5" aria-hidden="true" />}
                  title={request.status === 'PENDING' ? 'No quotes yet' : 'No quotes on this request'}
                  description={
                    request.status === 'PENDING'
                      ? 'Approved providers who match the category and area can send a quotation. You will be able to compare them here.'
                      : 'This request does not have any quotations to compare.'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {request.quotes.map((quote) => (
                    <article
                      key={quote.id}
                      className={cn(
                        'card-surface p-4 sm:p-5',
                        quote.status === 'ACCEPTED' ? 'border-brand-300 bg-brand-50/20' : '',
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <Avatar name={quote.provider.businessName} imageUrl={quote.provider.profileImage} size="md" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link
                                to={`/providers/${quote.provider.id}`}
                                className="text-sm font-bold hover:text-brand-800"
                              >
                                {quote.provider.businessName}
                              </Link>
                              {quote.provider.isDemo ? <DemoBadge label="Demo" /> : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Rating rating={quote.provider.ratingAvg} count={quote.provider.reviewCount} />
                              <VerificationBadges
                                identityVerified={quote.provider.identityVerified}
                                businessVerified={quote.provider.businessVerified}
                                compact
                              />
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-extrabold text-ink">{formatPeso(quote.proposedPrice)}</p>
                          <QuoteStatusBadge status={quote.status} />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
                        {quote.estimatedDuration ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                            {quote.estimatedDuration}
                          </span>
                        ) : null}
                        <span>Sent {formatDate(quote.createdAt)}</span>
                      </div>

                      {quote.priceNotes ? (
                        <p className="mt-3 whitespace-pre-wrap rounded-xl bg-paper px-3 py-2.5 text-sm leading-relaxed text-ink-soft">
                          {quote.priceNotes}
                        </p>
                      ) : null}

                      {quote.status === 'ACCEPTED' ? (
                        <div className="mt-3">
                          <Alert tone="success" title="You accepted this quote">
                            {request.status === 'COMPLETED'
                              ? 'The job for this accepted quote is complete. Contact details were shared with the provider.'
                              : request.status === 'IN_PROGRESS'
                                ? 'The provider marked this job as in progress. Contact details were shared with them.'
                                : request.status === 'CANCELLED'
                                  ? 'This request was cancelled after the quote was accepted.'
                                  : 'The provider can now start the job. Contact details were shared with them.'}
                          </Alert>
                        </div>
                      ) : null}

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line/80 pt-3">
                        <button
                          type="button"
                          onClick={() =>
                            setReportProvider({
                              id: quote.provider.id,
                              name: quote.provider.businessName,
                            })
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-clay"
                        >
                          <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                          Report this provider
                        </button>
                        {request.permissions.canAcceptQuotes && quote.status === 'PENDING' ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openQuoteAction('decline', quote)}
                            >
                              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                              Decline
                            </Button>
                            <Button size="sm" onClick={() => openQuoteAction('accept', quote)}>
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Accept quote
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          {isProvider ? (
            <section aria-labelledby="my-quote-heading">
              <div className="mb-3 flex items-end justify-between gap-2">
                <div>
                  <h2 id="my-quote-heading" className="text-lg font-extrabold">
                    Your quote
                  </h2>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-mute">
                    Only your own quote is visible here. Customer contact details stay hidden until
                    your quote is accepted.
                  </p>
                </div>
              </div>

              {user.provider?.approvalStatus !== 'APPROVED' ? (
                <Alert tone="warning" className="mb-3">
                  Your provider application is currently <strong>{user.provider?.approvalStatus.toLowerCase()}</strong>.
                  You can review the request, but only approved providers can send quotes. Check your
                  approval status on the dashboard.
                </Alert>
              ) : null}

              {providerQuote ? (
                <article className="card-surface p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute">
                        Proposed price
                      </p>
                      <p className="text-lg font-extrabold">{formatPeso(providerQuote.proposedPrice)}</p>
                    </div>
                    <QuoteStatusBadge status={providerQuote.status} />
                  </div>
                  {providerQuote.estimatedDuration ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-soft">
                      <Clock className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
                      {providerQuote.estimatedDuration}
                    </p>
                  ) : null}
                  {providerQuote.priceNotes ? (
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-paper px-3 py-2.5 text-sm leading-relaxed text-ink-soft">
                      {providerQuote.priceNotes}
                    </p>
                  ) : null}
                  <p className="mt-3 text-[11px] text-ink-mute">
                    Submitted {formatDateTime(providerQuote.createdAt)}
                    {providerQuote.updatedAt !== providerQuote.createdAt
                      ? ` · edited ${formatDateTime(providerQuote.updatedAt)}`
                      : ''}
                  </p>
                  {canEditQuote ? (
                    <div className="mt-4 flex justify-end border-t border-line/80 pt-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setQuoteDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit quote
                      </Button>
                    </div>
                  ) : null}
                </article>
              ) : request.permissions.canQuote ? (
                <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">This request matches your services</h3>
                      <p className="mt-1 max-w-lg text-xs leading-relaxed text-ink-soft">
                        Send one clear price and explain what is included. You cannot change the quote
                        after the customer accepts it.
                      </p>
                    </div>
                    <Button onClick={() => setQuoteDialogOpen(true)}>
                      <MessageSquareQuote className="h-4 w-4" aria-hidden="true" />
                      Send a quote
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="card-surface p-5 text-sm text-ink-soft">
                  You have not sent a quote for this request, and it is not currently open for a new
                  quote from your account.
                </div>
              )}

              {isAssignedProvider ? (
                <div className="mt-3 card-surface border-brand-200 p-4 sm:p-5">
                  <h3 className="text-sm font-bold">Job status</h3>
                  <p className="mt-1 text-xs text-ink-soft">
                    Current status: <strong>{REQUEST_STATUS_LABELS[request.status]}</strong>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.permissions.canStartJob ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActionError(null);
                          setJobAction('IN_PROGRESS');
                        }}
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        Start job
                      </Button>
                    ) : null}
                    {request.permissions.canCompleteJob ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActionError(null);
                          setJobAction('COMPLETED');
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Mark complete
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
                    Only update the status when it reflects the real work. Reviews open after
                    completion.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {request.review ? (
            <section className="card-surface p-5 sm:p-6" aria-labelledby="review-heading">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="review-heading" className="text-base font-extrabold">
                    {isCustomer ? 'Your review' : 'Customer review'}
                  </h2>
                  <p className="mt-1 text-xs text-ink-mute">
                    {isCustomer
                      ? 'This review is tied to this completed request.'
                      : 'Only customers with a completed job can review. You can respond publicly from the reviews page.'}
                  </p>
                </div>
                {isProvider ? (
                  <button
                    type="button"
                    onClick={() => setReportReview(request.review)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-mute hover:text-clay"
                  >
                    <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                    Report review
                  </button>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <Avatar name={request.review.customerDisplayName} size="sm" />
                <span className="font-semibold">{request.review.customerDisplayName}</span>
                <span className="text-xs text-ink-mute">{formatDate(request.review.createdAt)}</span>
                <StaticStars rating={request.review.rating} />
              </div>
              {request.review.comment ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                  {request.review.comment}
                </p>
              ) : (
                <p className="mt-3 text-sm italic text-ink-mute">No written comment was provided.</p>
              )}
              {request.review.providerResponse ? (
                <div className="mt-3 rounded-xl bg-paper px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                    Provider response
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {request.review.providerResponse}
                  </p>
                  {request.review.providerRespondedAt ? (
                    <p className="mt-1 text-[10px] text-ink-mute">
                      {formatDateTime(request.review.providerRespondedAt)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {request.permissions.canReview && isCustomer ? (
            <ReviewForm requestId={request.id} providerId={assignedProvider?.id ?? null} />
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="card-surface p-5">
            <h2 className="text-sm font-extrabold">Request summary</h2>
            <dl className="mt-3 space-y-3 text-xs">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-ink-mute">Status</dt>
                <dd className="mt-1">
                  <RequestStatusBadge status={request.status} />
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-ink-mute">Category</dt>
                <dd className="mt-0.5 text-sm font-medium">{request.category.name}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-ink-mute">Location</dt>
                <dd className="mt-0.5 text-sm font-medium">{locationLabel(request.location)}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-ink-mute">Preferred schedule</dt>
                <dd className="mt-0.5 text-sm font-medium">
                  {request.preferredSchedule ?? 'Not specified'}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-ink-mute">Posted</dt>
                <dd className="mt-0.5 text-sm font-medium">{formatDateTime(request.createdAt)}</dd>
              </div>
              {request.targetProvider ? (
                <div>
                  <dt className="font-semibold uppercase tracking-wide text-ink-mute">Direct request</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {isCustomer ? (
                      <Link
                        to={`/providers/${request.targetProvider.id}`}
                        className="text-brand-800 underline underline-offset-2"
                      >
                        {request.targetProvider.businessName}
                      </Link>
                    ) : (
                      request.targetProvider.businessName
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>

            {request.permissions.canCancel ? (
              <div className="mt-4 border-t border-line pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    setActionError(null);
                    setCancelOpen(true);
                  }}
                >
                  <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                  Cancel request
                </Button>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
                  Cancelling declines any pending quotes. This cannot be undone.
                </p>
              </div>
            ) : null}
          </div>

          {isCustomer && assignedProvider ? (
            <div className="card-surface p-5">
              <h2 className="text-sm font-extrabold">Selected provider</h2>
              <div className="mt-3 flex items-start gap-3">
                <Avatar
                  name={assignedProvider.businessName}
                  imageUrl={assignedProvider.profileImage}
                  size="md"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`/providers/${assignedProvider.id}`}
                      className="text-sm font-bold hover:text-brand-800"
                    >
                      {assignedProvider.businessName}
                    </Link>
                    {assignedProvider.isDemo ? <DemoBadge label="Demo" /> : null}
                  </div>
                  <div className="mt-1">
                    <VerificationBadges
                      identityVerified={assignedProvider.identityVerified}
                      businessVerified={assignedProvider.businessVerified}
                      compact
                    />
                  </div>
                </div>
              </div>
              {assignedProvider.contactEmail ? (
                <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-800">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Contact email
                  </p>
                  <a
                    href={`mailto:${assignedProvider.contactEmail}`}
                    className="mt-0.5 block break-all text-sm font-semibold text-brand-800 underline underline-offset-2"
                  >
                    {assignedProvider.contactEmail}
                  </a>
                  <p className="mt-1 text-[10px] leading-relaxed text-ink-mute">
                    Shared because you accepted this quote. Use it to agree on access and payment
                    details outside AyosDito.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-ink-mute">
                  Contact details are hidden while the job is cancelled or no longer active.
                </p>
              )}
            </div>
          ) : null}

          {isProvider && request.customer.contactEmail ? (
            <div className="card-surface p-5">
              <h2 className="text-sm font-extrabold">Customer contact</h2>
              <div className="mt-3 flex items-start gap-2">
                <UserRound className="mt-0.5 h-4 w-4 text-brand-700" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">{request.customer.displayName}</p>
                  <a
                    href={`mailto:${request.customer.contactEmail}`}
                    className="mt-1 block break-all text-xs font-semibold text-brand-800 underline underline-offset-2"
                  >
                    {request.customer.contactEmail}
                  </a>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
                This email was shared because the customer accepted your quote. Do not use it for
                unrelated marketing or add it to public pages.
              </p>
            </div>
          ) : isProvider ? (
            <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
              <p className="flex items-center gap-1.5 font-bold text-ink">
                <Lock className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
                Contact hidden
              </p>
              <p className="mt-2">
                Customer contact details stay private until your quote is accepted. Keep quote
                conversations inside the request record.
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
            <p className="flex items-center gap-1.5 font-bold text-ink">
              <Info className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
              Before the visit
            </p>
            <p className="mt-2">
              Agree on the final scope and price before work starts. AyosDito does not process
              payments, inspect work, or guarantee outcomes. Never share one-time passwords or
              unnecessary identity documents.
            </p>
          </div>
        </aside>
      </div>

      <Dialog
        open={quoteAction?.type === 'accept'}
        onOpenChange={(open) => {
          if (!open) setQuoteAction(null);
        }}
        title="Accept this quote?"
        description="Accepting assigns the job to this provider and shares your contact details with them."
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuoteAction(null)}>
              Keep comparing
            </Button>
            <Button
              loading={actionMutation.isPending}
              onClick={() => {
                if (quoteAction) runAction({ kind: 'accept', quoteId: quoteAction.quote.id });
              }}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Accept quote
            </Button>
          </>
        }
      >
        {actionError ? (
          <Alert tone="error" className="mb-3">
            {actionError}
          </Alert>
        ) : null}
        {quoteAction ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl bg-paper px-4 py-3">
              <p className="font-bold">{quoteAction.quote.provider.businessName}</p>
              <p className="mt-1 text-lg font-extrabold text-ink">
                {formatPeso(quoteAction.quote.proposedPrice)}
              </p>
              {quoteAction.quote.estimatedDuration ? (
                <p className="text-xs text-ink-mute">{quoteAction.quote.estimatedDuration}</p>
              ) : null}
            </div>
            <Alert tone="warning">
              Other pending quotes on this request will be declined. Your email address will be
              shared with this provider so you can coordinate the visit.
            </Alert>
            <p className="text-xs leading-relaxed text-ink-mute">
              The provider is still responsible for the final scope. A verification badge means an
              administrator checked details; it is not a guarantee of the work.
            </p>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={quoteAction?.type === 'decline'}
        onOpenChange={(open) => {
          if (!open) setQuoteAction(null);
        }}
        title="Decline this quote?"
        description="The provider will see that the quote was declined. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuoteAction(null)}>
              Go back
            </Button>
            <Button
              variant="danger"
              loading={actionMutation.isPending}
              onClick={() => {
                if (quoteAction) runAction({ kind: 'decline', quoteId: quoteAction.quote.id });
              }}
            >
              Decline quote
            </Button>
          </>
        }
      >
        {actionError ? (
          <Alert tone="error" className="mb-3">
            {actionError}
          </Alert>
        ) : null}
        {quoteAction ? (
          <p className="text-sm leading-relaxed text-ink-soft">
            Declining the quote from <strong>{quoteAction.quote.provider.businessName}</strong> will
            not cancel the whole request unless no other pending quotes remain.
          </p>
        ) : null}
      </Dialog>

      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) setActionError(null);
        }}
        title="Cancel this request?"
        description="Pending quotes will be declined and the provider will no longer be able to start the job."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>
              Keep request
            </Button>
            <Button
              variant="danger"
              loading={actionMutation.isPending}
              onClick={() => runAction({ kind: 'cancel' })}
            >
              Cancel request
            </Button>
          </>
        }
      >
        {actionError ? <Alert tone="error">{actionError}</Alert> : null}
        <p className="text-sm leading-relaxed text-ink-soft">
          Cancellation is final in this MVP. If work has already been agreed, contact the provider
          directly first so both sides understand what happens next.
        </p>
      </Dialog>

      <Dialog
        open={jobAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setJobAction(null);
            setActionError(null);
          }
        }}
        title={jobAction === 'COMPLETED' ? 'Mark this job complete?' : 'Start this job?'}
        description={
          jobAction === 'COMPLETED'
            ? 'Completion opens the customer review window and cannot be reversed by the provider.'
            : 'Only start once you have agreed the scope, schedule, and price with the customer.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setJobAction(null)}>
              Not yet
            </Button>
            <Button
              loading={actionMutation.isPending}
              onClick={() => {
                if (jobAction) runAction({ kind: 'status', status: jobAction });
              }}
            >
              {jobAction === 'COMPLETED' ? 'Mark complete' : 'Start job'}
            </Button>
          </>
        }
      >
        {actionError ? (
          <Alert tone="error" className="mb-3">
            {actionError}
          </Alert>
        ) : null}
        <p className="text-sm leading-relaxed text-ink-soft">
          The workspace records this status change. AyosDito does not verify that the work happened,
          so update it honestly.
        </p>
      </Dialog>

      {providerQuote ? (
        <QuoteFormDialog
          open={quoteDialogOpen}
          onOpenChange={setQuoteDialogOpen}
          requestId={request.id}
          quote={providerQuote}
        />
      ) : (
        <QuoteFormDialog
          open={quoteDialogOpen}
          onOpenChange={setQuoteDialogOpen}
          requestId={request.id}
        />
      )}

      {reportProvider ? (
        <ReportDialog
          open={Boolean(reportProvider)}
          onOpenChange={(open) => {
            if (!open) setReportProvider(null);
          }}
          entityType="PROVIDER"
          entityId={reportProvider.id}
          entityLabel={reportProvider.name}
        />
      ) : null}

      {reportReview ? (
        <ReportDialog
          open={Boolean(reportReview)}
          onOpenChange={(open) => {
            if (!open) setReportReview(null);
          }}
          entityType="REVIEW"
          entityId={reportReview.id}
          entityLabel="this review"
        />
      ) : null}

      <div className="flex items-start gap-2 rounded-xl border border-line bg-paper-soft px-4 py-3 text-[11px] leading-relaxed text-ink-mute">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
        <p>
          Keep communication and quote changes on the platform. If a provider asks you to pay before
          agreeing on scope, pressures you to cancel and pay elsewhere, or asks for unnecessary
          identity documents, use the report action or contact an administrator.
        </p>
      </div>
    </div>
  );
}

function StaticStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Rated ${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn('h-3.5 w-3.5', value <= rating ? 'fill-sun text-sun-deep' : 'fill-transparent text-line')}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

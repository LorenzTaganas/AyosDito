import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, MessageSquareReply, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { ProviderSelf, ReviewDto } from '@shared/api-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { formatDate, formatDateTime } from '@/lib/format';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { Rating } from '@/components/ui/Stars';
import { DemoBadge } from '@/components/ui/Verification';
import { ReportDialog } from '@/components/providers/ReportDialog';

export function ProviderReviewsPage() {
  useDocumentTitle('Reviews');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [responding, setResponding] = useState<ReviewDto | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responseError, setResponseError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<ReviewDto | null>(null);

  const self = useQuery({
    queryKey: queryKeys.providerSelf,
    queryFn: () => api.get<ProviderSelf>('/providers/me'),
  });

  const reviews = useQuery({
    queryKey: [...queryKeys.providerReviewsList, page],
    queryFn: () => api.list<ReviewDto>('/providers/me/reviews', { page, pageSize: 10 }),
  });

  const respondMutation = useMutation({
    mutationFn: (input: { reviewId: string; response: string }) =>
      api.patch<ReviewDto>(`/providers/me/reviews/${input.reviewId}/response`, {
        response: input.response,
      }),
    onSuccess: async () => {
      toast.success('Public response saved.');
      setResponding(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.providerReviewsList });
      await queryClient.invalidateQueries({ queryKey: queryKeys.providerDashboard });
      await queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
    onError: (error) => {
      setResponseError(error instanceof Error ? error.message : 'Could not save your response.');
    },
  });

  function openResponse(review: ReviewDto) {
    setResponding(review);
    setResponseText(review.providerResponse ?? '');
    setResponseError(null);
  }

  function submitResponse(event: React.FormEvent) {
    event.preventDefault();
    if (!responding) return;
    const text = responseText.trim();
    if (text.length < 10) {
      setResponseError('Write at least 10 characters.');
      return;
    }
    if (text.length > 1000) {
      setResponseError('Keep the response under 1,000 characters.');
      return;
    }
    setResponseError(null);
    respondMutation.mutate({ reviewId: responding.id, response: text });
  }

  const provider = self.data;
  const reviewCount = provider?.reviewCount ?? reviews.data?.meta.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reviews"
        title="What customers say after the work"
        description="Reviews come only from customers with a completed request. You can reply publicly, but you cannot edit, delete, or create reviews."
      />

      {user?.isDemo ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#f0dcaa] bg-sun-soft/50 px-4 py-3 text-xs text-sun-deep">
          <DemoBadge label="Demo reviews" />
          <span>
            The reviews on this account are sample data from the seed script, not real customer
            feedback.
          </span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card-surface flex items-center gap-4 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sun-soft text-sun-deep">
            <Star className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Average rating</p>
            {reviewCount === 0 ? (
              <p className="mt-1 text-lg font-extrabold">No reviews yet</p>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-2xl font-extrabold tracking-tight">
                  {(provider?.ratingAvg ?? 0).toFixed(1)}
                </span>
                <Rating rating={provider?.ratingAvg ?? 0} count={reviewCount} />
              </div>
            )}
          </div>
        </div>
        <div className="card-surface flex items-center gap-4 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <MessageSquareReply className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Visible reviews</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight">{reviewCount}</p>
            <p className="text-xs text-ink-mute">
              Sorted newest first. Hidden reviews are excluded from your public rating.
            </p>
          </div>
        </div>
      </div>

      {reviews.isPending ? (
        <LoadingBlock label="Loading reviews…" />
      ) : reviews.isError ? (
        <ErrorState
          message="We could not load your reviews. Check your connection and try again."
          onRetry={() => reviews.refetch()}
        />
      ) : reviews.data.data.length === 0 ? (
        <EmptyState
          icon={<Star className="h-5 w-5" aria-hidden="true" />}
          title="No reviews yet"
          description="When a customer marks a completed request, they can leave one review with an optional comment. Reviews cannot be created by the provider."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-mute">
              {reviews.data.meta.total} {reviews.data.meta.total === 1 ? 'review' : 'reviews'}
            </p>
            <Badge variant="outline">Page {reviews.data.meta.page} of {Math.max(1, reviews.data.meta.totalPages)}</Badge>
          </div>

          <div className="space-y-3">
            {reviews.data.data.map((review) => (
              <article key={review.id} className="card-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{review.customerDisplayName}</span>
                      <span className="text-xs text-ink-mute">{formatDate(review.createdAt)}</span>
                    </div>
                    <div className="mt-1">
                      <Rating rating={review.rating} count={1} showCount={false} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openResponse(review)}>
                      <MessageSquareReply className="h-3.5 w-3.5" aria-hidden="true" />
                      {review.providerResponse ? 'Edit response' : 'Respond'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setReporting(review)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ink-mute hover:bg-clay-soft/50 hover:text-clay"
                    >
                      <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                      Report
                    </button>
                  </div>
                </div>

                {review.comment ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {review.comment}
                  </p>
                ) : (
                  <p className="mt-3 text-sm italic text-ink-mute">No written comment.</p>
                )}

                {review.providerResponse ? (
                  <div className="mt-3 rounded-xl bg-paper px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                      Your public response
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                      {review.providerResponse}
                    </p>
                    {review.providerRespondedAt ? (
                      <p className="mt-1 text-[10px] text-ink-mute">
                        Posted {formatDateTime(review.providerRespondedAt)}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-ink-mute">
                    A short, factual response helps future customers understand how you handled the
                    job. Do not include private customer details.
                  </p>
                )}
              </article>
            ))}
          </div>

          <Pagination
            page={reviews.data.meta.page}
            pageSize={reviews.data.meta.pageSize}
            total={reviews.data.meta.total}
            totalPages={reviews.data.meta.totalPages}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">Reviews are honest signals</p>
        <p className="mt-2">
          Do not ask customers to change or remove a truthful review, and do not offer rewards for a
          positive rating. If a review contains abusive content or private information, report it to
          an administrator for review. Responses are public.
        </p>
      </div>

      <Dialog
        open={responding !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResponding(null);
            setResponseError(null);
          }
        }}
        title={responding?.providerResponse ? 'Edit your response' : 'Respond to this review'}
        description="Your response is public and appears directly under the review."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setResponding(null);
                setResponseError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="review-response-form"
              loading={respondMutation.isPending}
            >
              {responding?.providerResponse ? 'Save response' : 'Post response'}
            </Button>
          </>
        }
      >
        {responding ? (
          <div className="mb-4 rounded-xl bg-paper px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{responding.customerDisplayName}</span>
              <Rating rating={responding.rating} count={1} showCount={false} />
            </div>
            {responding.comment ? (
              <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-soft">
                {responding.comment}
              </p>
            ) : null}
          </div>
        ) : null}
        <form id="review-response-form" onSubmit={submitResponse} className="space-y-3" noValidate>
          {responseError ? <Alert tone="error">{responseError}</Alert> : null}
          <Field
            id="review-response"
            label="Public response"
            hint="10–1,000 characters. Keep it factual and do not share private customer information."
          >
            <Textarea
              id="review-response"
              rows={5}
              maxLength={1000}
              value={responseText}
              onChange={(event) => setResponseText(event.target.value)}
              placeholder="Example: Salamat po sa feedback. We replaced the loose connector and tested the unit before handover. Message us if the issue returns."
            />
          </Field>
        </form>
      </Dialog>

      {reporting ? (
        <ReportDialog
          open={Boolean(reporting)}
          onOpenChange={(open) => {
            if (!open) setReporting(null);
          }}
          entityType="REVIEW"
          entityId={reporting.id}
          entityLabel="this review"
        />
      ) : null}
    </div>
  );
}

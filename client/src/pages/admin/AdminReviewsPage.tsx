import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminReviewDto } from '@shared/api-types';
import { REVIEW_MODERATION_STATUSES } from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { errorMessage, parseAdminFilter } from '@/lib/admin';
import { formatDateTime, pluralize } from '@/lib/format';
import { useAdminListParams } from '@/hooks/adminList';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { Rating } from '@/components/ui/Stars';
import { DemoBadge } from '@/components/ui/Verification';
import { AdminFilterTabs, AdminSearch } from '@/components/admin/AdminFilters';
import { ModerationStatusBadge } from '@/components/admin/AdminBadges';

const MODERATION_TABS = [
  { value: 'ALL', label: 'All reviews' },
  { value: 'VISIBLE', label: 'Visible' },
  { value: 'HIDDEN', label: 'Hidden' },
];

export function AdminReviewsPage() {
  useDocumentTitle('Review moderation');
  const queryClient = useQueryClient();
  const { params, page, update, reset } = useAdminListParams();
  const q = params.get('q') ?? '';
  const moderation = parseAdminFilter(params.get('moderationStatus'), REVIEW_MODERATION_STATUSES);

  const [hiding, setHiding] = useState<AdminReviewDto | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const reviews = useQuery({
    queryKey: queryKeys.adminReviews({ q, moderation, page }),
    queryFn: () =>
      api.list<AdminReviewDto>('/admin/reviews', {
        q: q || undefined,
        moderationStatus: moderation === 'ALL' ? undefined : moderation,
        page,
        pageSize: 20,
      }),
  });

  const moderationMutation = useMutation({
    mutationFn: (input: {
      reviewId: string;
      moderationStatus: 'VISIBLE' | 'HIDDEN';
      reason?: string;
    }) =>
      api.patch<AdminReviewDto>(`/admin/reviews/${input.reviewId}/moderation`, {
        moderationStatus: input.moderationStatus,
        reason: input.reason,
      }),
    onSuccess: async (_data, input) => {
      toast.success(
        input.moderationStatus === 'HIDDEN'
          ? 'Review hidden. The provider’s public rating was recalculated.'
          : 'Review restored. It is visible and included in the public rating again.',
      );
      setHiding(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard }),
        queryClient.invalidateQueries({ queryKey: ['providers'] }),
      ]);
    },
    onError: (error) => {
      if (hiding) setFormError(errorMessage(error, 'Could not moderate this review.'));
      else toast.error(errorMessage(error, 'Could not restore this review.'));
    },
  });

  function openHide(review: AdminReviewDto) {
    setHiding(review);
    setReason('');
    setFormError(null);
  }

  function submitHide(event: React.FormEvent) {
    event.preventDefault();
    if (!hiding) return;
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      setFormError('Explain why this review is being hidden (at least 10 characters).');
      return;
    }
    setFormError(null);
    moderationMutation.mutate({
      reviewId: hiding.id,
      moderationStatus: 'HIDDEN',
      reason: trimmed,
    });
  }

  const hasFilters = Boolean(q) || moderation !== 'ALL';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Trust and safety"
        title="Review moderation"
        description="Reviews can only be written by customers after a completed job. Hiding a review removes it from the public profile and recalculates the provider’s rating; it does not delete the record."
      />

      <div className="space-y-3">
        <AdminFilterTabs
          label="Filter reviews by visibility"
          options={MODERATION_TABS}
          value={moderation}
          onChange={(value) => update({ moderationStatus: value === 'ALL' ? null : value })}
        />
        <AdminSearch
          placeholder="Search comment, customer, or provider"
          label="Search reviews"
        />
      </div>

      {reviews.isPending ? (
        <LoadingBlock label="Loading reviews…" />
      ) : reviews.isError ? (
        <ErrorState
          message="We could not load reviews. Check your connection and try again."
          onRetry={() => reviews.refetch()}
        />
      ) : reviews.data.data.length === 0 ? (
        <EmptyState
          icon={<Star className="h-5 w-5" aria-hidden="true" />}
          title="No reviews match these filters"
          description={
            hasFilters
              ? 'Try another visibility filter or search term, or clear the filters.'
              : 'Reviews appear here after customers complete a service and leave feedback.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={reset}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-mute">
              {pluralize(reviews.data.meta.total, 'review')}
              {q ? ` · matching “${q}”` : ''}
            </p>
            <Badge variant="outline">
              Page {reviews.data.meta.page} of {Math.max(1, reviews.data.meta.totalPages)}
            </Badge>
          </div>

          <div className="space-y-3">
            {reviews.data.data.map((review) => (
              <article key={review.id} className="card-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar name={review.author.displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">
                        {review.author.displayName}
                        {review.author.isDemo ? <DemoBadge label="Demo author" /> : null}
                        <ModerationStatusBadge status={review.moderationStatus} />
                      </p>
                      <p className="mt-0.5 break-all text-xs text-ink-mute">{review.author.email}</p>
                      <p className="mt-0.5 text-[11px] text-ink-mute">
                        {formatDateTime(review.createdAt)} · for {review.provider.businessName}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Rating rating={review.rating} count={1} showCount={false} />
                    {review.moderationStatus === 'VISIBLE' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-clay"
                        onClick={() => openHide(review)}
                      >
                        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                        Hide
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={
                          moderationMutation.isPending &&
                          moderationMutation.variables?.reviewId === review.id
                        }
                        onClick={() =>
                          moderationMutation.mutate({
                            reviewId: review.id,
                            moderationStatus: 'VISIBLE',
                          })
                        }
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        Restore
                      </Button>
                    )}
                  </div>
                </div>

                {review.comment ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl bg-paper px-3.5 py-3 text-sm leading-relaxed text-ink-soft">
                    {review.comment}
                  </p>
                ) : (
                  <p className="mt-3 text-sm italic text-ink-mute">No written comment.</p>
                )}

                {review.providerResponse ? (
                  <div className="mt-3 rounded-xl border border-line/80 bg-paper-soft px-3.5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                      Provider response
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                      {review.providerResponse}
                    </p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <Pagination
            page={reviews.data.meta.page}
            pageSize={reviews.data.meta.pageSize}
            total={reviews.data.meta.total}
            totalPages={reviews.data.meta.totalPages}
            onPageChange={(nextPage) => {
              update({ page: String(nextPage) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">Moderation standards</p>
        <p className="mt-2">
          Hide reviews only for abusive content, spam, private information, or content that violates
          the platform rules. Do not hide a review because it is negative or because a provider
          disagrees with it. Every hide decision requires a reason and is recorded in the audit log.
        </p>
      </div>

      <Dialog
        open={hiding !== null}
        onOpenChange={(open) => {
          if (!open && !moderationMutation.isPending) setHiding(null);
        }}
        title={hiding ? `Hide this review by ${hiding.author.displayName}?` : ''}
        description="The review disappears from the public provider profile and is excluded from the provider’s rating. The record is kept and can be restored."
      >
        {hiding ? (
          <form id="review-hide-form" onSubmit={submitHide} className="space-y-4">
            {formError ? <Alert tone="error">{formError}</Alert> : null}
            <div className="rounded-xl border border-line bg-paper px-3.5 py-3">
              <Rating rating={hiding.rating} count={1} showCount={false} />
              <p className="mt-1 text-xs text-ink-mute">For {hiding.provider.businessName}</p>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-soft">
                {hiding.comment ?? 'No written comment.'}
              </p>
            </div>
            <Field
              id="review-hide-reason"
              label="Reason for hiding"
              required
              hint="10–500 characters. Recorded in the audit log. Do not include private personal information."
            >
              <Textarea
                id="review-hide-reason"
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Example: The comment includes a customer’s full home address, which must not be public."
              />
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setHiding(null)}
                disabled={moderationMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" loading={moderationMutation.isPending}>
                <EyeOff className="h-4 w-4" aria-hidden="true" />
                Hide review
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}

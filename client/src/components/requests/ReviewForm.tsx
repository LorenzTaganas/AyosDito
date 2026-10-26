import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star } from 'lucide-react';
import type { ReviewDto } from '@shared/api-types';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Field, Textarea } from '@/components/ui/Field';

export function ReviewForm({
  requestId,
  providerId,
}: {
  requestId: string;
  providerId: string | null;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      setError('Choose a rating from 1 to 5 stars.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.post<ReviewDto>(`/requests/${requestId}/review`, {
        rating,
        comment: comment.trim() || undefined,
      });
      toast.success('Review posted. Thank you for the feedback.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId) });
      if (providerId) {
        await queryClient.invalidateQueries({ queryKey: ['providers', providerId] });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.providerDashboard });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not post the review.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card-surface p-5" aria-labelledby="review-form-heading">
      <h2 id="review-form-heading" className="text-base font-extrabold">
        Leave a review
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-mute">
        The job is marked complete. You can leave one review for this request. It will appear with
        your shortened name, and the provider may post one public response.
      </p>

      {error ? (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      ) : null}

      <div className="mt-4">
        <span className="field-label">Rating</span>
        <div className="flex items-center gap-1.5" role="group" aria-label="Choose a star rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setRating(value);
                setError(null);
              }}
              aria-label={`Rate ${value} out of 5`}
              aria-pressed={rating === value}
              className="rounded-lg p-1 transition hover:bg-sun-soft focus-visible:outline-none"
            >
              <Star
                className={cn(
                  'h-7 w-7',
                  value <= rating ? 'fill-sun text-sun-deep' : 'fill-transparent text-line',
                )}
                aria-hidden="true"
              />
            </button>
          ))}
          <span className="ml-1 text-xs font-semibold text-ink-mute">
            {rating > 0 ? `${rating} of 5` : 'Not rated yet'}
          </span>
        </div>
      </div>

      <Field
        id="review-comment"
        label="Comment (optional)"
        hint="Describe the work and communication. Do not include addresses, ID numbers, or private contact details."
        className="mt-4"
      >
        <Textarea
          id="review-comment"
          rows={4}
          maxLength={1000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What went well? Was the scope and price clear?"
        />
      </Field>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-sm text-[11px] leading-relaxed text-ink-mute">
          Reviews cannot be deleted by the provider. If a review breaks the rules, use the report
          action so a moderator can review it.
        </p>
        <Button type="submit" loading={submitting} disabled={rating === 0}>
          Post review
        </Button>
      </div>
    </form>
  );
}

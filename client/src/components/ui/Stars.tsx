import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Stars({
  rating,
  count,
  size = 'sm',
  className,
}: {
  rating: number;
  count: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const starSize = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const rounded = Math.round(rating);
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`Rated ${rating.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'review' : 'reviews'}`}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(starSize, value <= rounded ? 'fill-sun text-sun' : 'fill-transparent text-line')}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function Rating({
  rating,
  count,
  size = 'sm',
  showCount = true,
  className,
}: {
  rating: number;
  count: number;
  size?: 'sm' | 'md';
  showCount?: boolean;
  className?: string;
}) {
  if (count === 0) {
    return <span className={cn('text-xs font-medium text-ink-mute', className)}>No reviews yet</span>;
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <Stars rating={rating} count={count} size={size} />
      <span className="text-xs font-bold text-ink">{rating.toFixed(1)}</span>
      {showCount ? (
        <span className="text-xs text-ink-mute">
          ({count} {count === 1 ? 'review' : 'reviews'})
        </span>
      ) : null}
    </span>
  );
}

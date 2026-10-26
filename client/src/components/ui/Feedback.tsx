import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-700', className)} aria-hidden="true" />;
}

export function LoadingBlock({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-12 text-sm font-medium text-ink-mute', className)}>
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <LoadingBlock label="Loading AyosDito…" />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-paper-deep', className)} aria-hidden="true" />;
}

export function ProviderCardSkeleton() {
  return (
    <div className="card-surface p-5">
      <div className="flex gap-4">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-5 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <div className="mt-5 flex justify-between">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-dashed border-line bg-paper-soft/70 px-6 py-12 text-center', className)}>
      {icon ? (
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-paper-deep text-ink-soft">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-mute">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  children,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-clay/20 bg-clay-soft/50 px-6 py-10 text-center">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-10 items-center rounded-xl border border-line bg-paper-soft px-4 text-sm font-semibold text-ink hover:bg-paper-deep"
        >
          Try again
        </button>
      ) : null}
      {children}
    </div>
  );
}

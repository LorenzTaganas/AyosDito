import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
  tone = 'default',
  loading = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  to?: string;
  tone?: 'default' | 'warning' | 'success';
  loading?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn(
          'grid h-10 w-10 place-items-center rounded-xl',
          tone === 'warning'
            ? 'bg-sun-soft text-sun-deep'
            : tone === 'success'
              ? 'bg-brand-50 text-brand-700'
              : 'bg-paper-deep text-ink-soft',
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="mt-4 flex items-end justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">{label}</span>
        {to ? <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-mute" aria-hidden="true" /> : null}
      </span>
      <span className="mt-1 block text-2xl font-extrabold tracking-tight text-ink">
        {loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-paper-deep" /> : value}
      </span>
      {hint ? <span className="mt-1 block text-xs leading-relaxed text-ink-mute">{hint}</span> : null}
    </>
  );

  const className = cn(
    'card-surface block p-4 transition',
    to ? 'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift' : '',
  );

  if (to) {
    return (
      <Link to={to} className={className} aria-label={`${label}: ${value}`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

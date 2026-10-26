import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'neutral' | 'brand' | 'sun' | 'sky' | 'danger' | 'outline';

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-paper-deep text-ink-soft border-transparent',
  brand: 'bg-brand-50 text-brand-800 border-brand-100',
  sun: 'bg-sun-soft text-sun-deep border-[#f0dcaa]',
  sky: 'bg-sky-soft text-sky-deep border-[#cfe0eb]',
  danger: 'bg-clay-soft text-clay border-[#f0cfc6]',
  outline: 'bg-transparent text-ink-soft border-line',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'neutral', size = 'sm', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-semibold leading-none',
        size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn('inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70', className)} aria-hidden="true" />;
}

export function KeyValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

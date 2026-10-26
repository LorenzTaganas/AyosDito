import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  info: {
    wrapper: 'border-[#cfe0eb] bg-sky-soft/70 text-sky-deep',
    icon: Info,
  },
  success: {
    wrapper: 'border-brand-200 bg-brand-50 text-brand-900',
    icon: CheckCircle2,
  },
  warning: {
    wrapper: 'border-[#f0dcaa] bg-sun-soft/70 text-sun-deep',
    icon: TriangleAlert,
  },
  error: {
    wrapper: 'border-clay/25 bg-clay-soft/60 text-[#8f2f1d]',
    icon: AlertCircle,
  },
} as const;

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const config = TONES[tone];
  const Icon = config.icon;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed', config.wrapper, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title ? 'mt-0.5' : '', 'text-[13px] leading-relaxed opacity-90')}>{children}</div>
      </div>
    </div>
  );
}

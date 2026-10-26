import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { buttonStyles } from './Button';

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('h-9 w-9', className)} role="img" aria-label="AyosDito mark">
      <rect width="32" height="32" rx="9" fill="#0E5345" />
      <path
        d="M18.7 9.4a4.2 4.2 0 0 0-5.3 5.3l-4.1 4.1a1.6 1.6 0 0 0 2.3 2.3l4.1-4.1a4.2 4.2 0 0 0 5.3-5.3l-2.2 2.2-2.1-.6-.6-2.1 2.6-1.8Z"
        fill="#FBF9F4"
      />
      <circle cx="23.5" cy="8.8" r="2.2" fill="#F2B33D" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2.5 rounded-lg', className)}
      aria-label="AyosDito home"
    >
      <LogoMark />
      <span
        className={cn(
          'font-display text-[21px] font-extrabold leading-none tracking-tight',
          inverted ? 'text-paper-soft' : 'text-ink',
        )}
      >
        Ayos<span className={inverted ? 'text-brand-200' : 'text-brand-700'}>Dito</span>
        <span className="text-sun">.</span>
      </span>
    </Link>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  linkTo,
  linkLabel,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  linkTo?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {linkTo && linkLabel ? (
        <Link to={linkTo} className={buttonStyles({ variant: 'link', size: 'sm', className: 'shrink-0' })}>
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

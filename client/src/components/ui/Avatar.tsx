import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = ['bg-brand-100 text-brand-800', 'bg-sky-soft text-sky-deep', 'bg-sun-soft text-sun-deep', 'bg-clay-soft text-clay', 'bg-paper-deep text-ink-soft'];

export function Avatar({
  name,
  imageUrl,
  size = 'md',
  className,
}: {
  name: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizes = {
    sm: 'h-8 w-8 rounded-lg text-[11px]',
    md: 'h-11 w-11 rounded-xl text-sm',
    lg: 'h-16 w-16 rounded-2xl text-lg',
    xl: 'h-24 w-24 rounded-3xl text-2xl',
  } as const;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  const hash = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const tone = TONES[hash % TONES.length];

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={`${name} profile`}
        className={cn('shrink-0 border border-line object-cover', sizes[size], className)}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center border border-line/60 font-display font-extrabold',
        sizes[size],
        tone,
        className,
      )}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}

export function IconTile({
  icon: Icon,
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'h-9 w-9 rounded-lg [&>svg]:h-4 [&>svg]:w-4',
    md: 'h-12 w-12 rounded-xl [&>svg]:h-5 [&>svg]:w-5',
    lg: 'h-14 w-14 rounded-2xl [&>svg]:h-6 [&>svg]:w-6',
  } as const;
  return (
    <span
      className={cn(
        'grid place-items-center bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100',
        sizes[size],
        className,
      )}
    >
      <Icon aria-hidden="true" />
    </span>
  );
}

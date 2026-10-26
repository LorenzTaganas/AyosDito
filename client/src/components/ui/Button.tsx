import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'sun' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-700 text-paper-soft shadow-sm hover:bg-brand-800 active:bg-brand-900 disabled:bg-brand-700/50',
  secondary:
    'border border-line bg-paper-soft text-ink shadow-sm hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50',
  ghost: 'text-ink-soft hover:bg-paper-deep hover:text-ink disabled:opacity-50',
  subtle: 'bg-brand-50 text-brand-800 hover:bg-brand-100 disabled:opacity-50',
  danger: 'bg-clay text-white shadow-sm hover:bg-[#a93a25] disabled:opacity-50',
  sun: 'bg-sun text-brand-950 shadow-sm hover:bg-[#e8a82f] disabled:opacity-50',
  link: 'text-brand-700 underline-offset-4 hover:underline disabled:opacity-50',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-sm',
  md: 'h-11 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-[15px]',
  icon: 'h-10 w-10',
};

export function buttonStyles(options: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  const { variant = 'primary', size = 'md', fullWidth, className } = options;
  return cn(
    'inline-flex select-none items-center justify-center whitespace-nowrap rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:translate-y-0',
    VARIANTS[variant],
    SIZES[size],
    variant === 'link' ? 'h-auto p-0' : '',
    fullWidth ? 'w-full' : '',
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', fullWidth, loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonStyles({ variant, size, fullWidth, className })}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

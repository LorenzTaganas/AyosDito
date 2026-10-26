import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const controlBase =
  'w-full rounded-xl border border-line bg-white/80 px-3.5 text-sm text-ink shadow-sm transition placeholder:text-ink-mute/70 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/20 disabled:cursor-not-allowed disabled:bg-paper-deep/60 disabled:text-ink-mute aria-[invalid=true]:border-clay aria-[invalid=true]:ring-clay/15';

export interface FieldProps {
  id?: string;
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ id, label, hint, error, required, className, children }: FieldProps) {
  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <label htmlFor={id} className="field-label">
          {label}
          {required ? (
            <span className="ml-0.5 text-clay" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="field-help">{hint}</p> : null}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs font-medium text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlBase, 'h-11', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(controlBase, 'py-2.5', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <span className="relative block">
        <select ref={ref} className={cn(controlBase, 'h-11 appearance-none pr-9', className)} {...props}>
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
          aria-hidden="true"
        />
      </span>
    );
  },
);

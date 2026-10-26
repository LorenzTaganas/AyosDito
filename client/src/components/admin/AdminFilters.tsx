import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

export interface AdminFilterOption {
  value: string;
  label: string;
}

export function AdminFilterTabs({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: AdminFilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto pb-1', className)}>
      <div className="flex w-max gap-1.5" role="tablist" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition',
              value === option.value
                ? 'border-brand-700 bg-brand-700 text-white'
                : 'border-line bg-paper-soft text-ink-soft hover:border-brand-200 hover:text-ink',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminSearch({
  placeholder,
  label,
  className,
}: {
  placeholder: string;
  label: string;
  className?: string;
}) {
  const [params, setParams] = useSearchParams();
  const current = params.get('q') ?? '';
  const [value, setValue] = useState(current);
  const inputId = useId();

  useEffect(() => {
    setValue(current);
  }, [current]);

  function applyQuery(nextValue: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (nextValue.trim()) next.set('q', nextValue.trim());
        else next.delete('q');
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }

  return (
    <form
      role="search"
      className={cn('flex w-full flex-wrap items-center gap-2 sm:w-auto', className)}
      onSubmit={(event) => {
        event.preventDefault();
        applyQuery(value);
      }}
    >
      <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
          aria-hidden="true"
        />
        <Input
          id={inputId}
          type="search"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(event) => setValue(event.target.value)}
          className="h-10 pl-9 pr-8"
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue('');
              if (current) applyQuery('');
            }}
            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-ink-mute hover:bg-paper-deep hover:text-ink"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Search
      </Button>
    </form>
  );
}

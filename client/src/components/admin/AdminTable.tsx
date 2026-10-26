import type { CSSProperties, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const adminActionsHeaderClass =
  'text-right xl:sticky xl:right-0 xl:z-20 xl:border-l xl:border-line xl:bg-paper-deep';

export const adminActionsCellClass =
  'text-right xl:sticky xl:right-0 xl:z-10 xl:border-l xl:border-line xl:bg-paper-soft';

export function AdminTableShell({
  label,
  minWidth = 760,
  className,
  children,
}: {
  label: string;
  minWidth?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('card-surface overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table
          role="table"
          aria-label={label}
          className="block w-full text-left text-sm xl:table xl:min-w-[var(--admin-table-min)]"
          style={{ '--admin-table-min': `${minWidth}px` } as CSSProperties}
        >
          {children}
        </table>
      </div>
    </div>
  );
}

export function AdminThead({ children }: { children: ReactNode }) {
  return (
    <thead
      role="rowgroup"
      className="hidden border-b border-line bg-paper-deep/60 text-[11px] font-semibold uppercase tracking-wide text-ink-mute xl:table-header-group"
    >
      {children}
    </thead>
  );
}

export function AdminTh({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      role="columnheader"
      className={cn('whitespace-nowrap px-4 py-3 font-semibold', className)}
      {...props}
    >
      {children}
    </th>
  );
}

export function AdminTd({
  className,
  label,
  children,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { label?: string }) {
  return (
    <td
      role="cell"
      className={cn('block px-4 py-2 align-top xl:table-cell xl:py-3.5', className)}
      {...props}
    >
      {label ? (
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-mute xl:hidden">
          {label}
        </span>
      ) : null}
      {children}
    </td>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return (
    <tbody role="rowgroup" className="block divide-y divide-line/80 xl:table-row-group">
      {children}
    </tbody>
  );
}

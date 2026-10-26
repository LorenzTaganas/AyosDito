import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

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
        <table className="w-full text-left text-sm" style={{ minWidth }} aria-label={label}>
          {children}
        </table>
      </div>
    </div>
  );
}

export function AdminThead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-paper-deep/60 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
      {children}
    </thead>
  );
}

export function AdminTh({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={cn('whitespace-nowrap px-4 py-3 font-semibold', className)} {...props}>
      {children}
    </th>
  );
}

export function AdminTd({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3.5 align-top', className)} {...props}>
      {children}
    </td>
  );
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line/80">{children}</tbody>;
}

import {
  Flag,
  MapPin,
  ScrollText,
  ShieldCheck,
  ShieldPlus,
  Star,
  Store,
  Tags,
  UserRoundCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuditLogDto } from '@shared/api-types';
import { auditActionLabel, humanizeKey } from '@/lib/admin';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

function actionIcon(action: string): LucideIcon {
  if (action.startsWith('provider.')) return Store;
  if (action.startsWith('verification.')) return ShieldCheck;
  if (action === 'user.admin_granted') return ShieldPlus;
  if (action.startsWith('user.')) return UserRoundCog;
  if (action.startsWith('review.')) return Star;
  if (action.startsWith('report.')) return Flag;
  if (action.startsWith('category.')) return Tags;
  if (action.startsWith('location.')) return MapPin;
  return ScrollText;
}

function iconTone(action: string): string {
  if (action.includes('rejected') || action === 'report.resolved' || action === 'user.status_changed') {
    return 'bg-clay-soft text-clay';
  }
  if (action.includes('approved') || action.includes('granted')) {
    return 'bg-brand-50 text-brand-700';
  }
  return 'bg-paper-deep text-ink-soft';
}

function metadataValue(value: unknown): string {
  if (value === null) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function AuditMetadata({ metadata }: { metadata: Record<string, unknown> }) {
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  );
  if (entries.length === 0) return null;
  return (
    <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg border border-line/70 bg-paper px-3 py-2 text-[11px] sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex min-w-0 flex-wrap gap-x-1.5">
          <dt className="shrink-0 font-semibold text-ink-mute">{humanizeKey(key)}:</dt>
          <dd className="min-w-0 break-words text-ink-soft">{metadataValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AuditEntry({ log, compact = false }: { log: AuditLogDto; compact?: boolean }) {
  const Icon = actionIcon(log.action);
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', iconTone(log.action))}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-semibold text-ink">{auditActionLabel(log.action)}</p>
          <p className="shrink-0 text-[11px] text-ink-mute">{formatDateTime(log.createdAt)}</p>
        </div>
        <p className="mt-0.5 break-words text-xs leading-relaxed text-ink-mute">
          {log.actor ? (
            <>
              {log.actor.fullName} <span className="text-ink-mute/80">({log.actor.email})</span>
            </>
          ) : (
            'System'
          )}
          {' · '}
          <span className="font-mono text-[10px] uppercase tracking-wide">
            {log.entityType.replace(/_/g, ' ')}
          </span>
          {!compact && log.entityId ? (
            <>
              {' · '}
              <span className="font-mono text-[10px]" title={log.entityId}>
                {log.entityId}
              </span>
            </>
          ) : null}
        </p>
        {!compact && log.metadata ? <AuditMetadata metadata={log.metadata} /> : null}
      </div>
    </li>
  );
}

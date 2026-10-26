import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import type { AuditLogDto } from '@shared/api-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { pluralize } from '@/lib/format';
import { useAdminListParams } from '@/hooks/adminList';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { AdminSearch } from '@/components/admin/AdminFilters';
import { AuditEntry } from '@/components/admin/AuditEntry';

export function AdminAuditPage() {
  useDocumentTitle('Audit log');
  const { params, page, update, reset } = useAdminListParams();
  const q = params.get('q') ?? '';

  const audit = useQuery({
    queryKey: queryKeys.adminAudit({ q, page }),
    queryFn: () =>
      api.list<AuditLogDto>('/admin/audit-logs', {
        q: q || undefined,
        page,
        pageSize: 30,
      }),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Accountability"
        title="Audit log"
        description="Read-only history of administrative decisions and catalog changes. Each entry records the administrator, the action, the affected record, and any reason or metadata saved with it."
        actions={<Badge variant="outline">Read-only</Badge>}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <AdminSearch placeholder="Search action, entity, actor, or ID" label="Search audit log" />
        <p className="text-xs text-ink-mute">
          Search matches the action, entity type, entity ID, administrator name, and email.
        </p>
      </div>

      {audit.isPending ? (
        <LoadingBlock label="Loading audit log…" />
      ) : audit.isError ? (
        <ErrorState
          message="We could not load the audit log. Check your connection and try again."
          onRetry={() => audit.refetch()}
        />
      ) : audit.data.data.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" aria-hidden="true" />}
          title={q ? 'No entries match this search' : 'No administrative actions recorded yet'}
          description={
            q
              ? 'Try a different action, entity, or administrator name.'
              : 'Approvals, account changes, moderation decisions, and catalog updates will appear here.'
          }
          action={
            q ? (
              <Button variant="secondary" onClick={reset}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-mute">
              {pluralize(audit.data.meta.total, 'entry', 'entries')}
              {q ? ` · matching “${q}”` : ''}
            </p>
            <Badge variant="outline">
              Page {audit.data.meta.page} of {Math.max(1, audit.data.meta.totalPages)}
            </Badge>
          </div>

          <div className="card-surface p-4 sm:p-5">
            <ul className="divide-y divide-line/80">
              {audit.data.data.map((log) => (
                <AuditEntry key={log.id} log={log} />
              ))}
            </ul>
          </div>

          <Pagination
            page={audit.data.meta.page}
            pageSize={audit.data.meta.pageSize}
            total={audit.data.meta.total}
            totalPages={audit.data.meta.totalPages}
            onPageChange={(nextPage) => {
              update({ page: String(nextPage) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">About these records</p>
        <p className="mt-2">
          Audit entries are written by the server in the same database transaction as the action
          they describe. There is no endpoint to edit or delete an entry. Identifiers are shown in
          monospace so they can be matched against the affected record. Metadata may include
          decision reasons and previous values, so treat this page as private administrative data.
        </p>
      </div>
    </div>
  );
}

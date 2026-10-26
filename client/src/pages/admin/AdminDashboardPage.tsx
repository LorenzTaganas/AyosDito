import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Flag, Store, UsersRound, Wrench } from 'lucide-react';
import type { AdminDashboardDto } from '@shared/api-types';
import {
  REQUEST_STATUSES,
  REQUEST_STATUS_LABELS,
  REPORT_REASON_LABELS,
  type RequestStatus,
} from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { formatDate, truncate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/Brand';
import { buttonStyles } from '@/components/ui/Button';
import { DemoBadge } from '@/components/ui/Verification';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { StatCard } from '@/components/dashboard/StatCard';
import { AuditEntry } from '@/components/admin/AuditEntry';
import { ReportStatusBadge } from '@/components/admin/AdminBadges';

const PIPELINE_TONES: Record<RequestStatus, string> = {
  PENDING: 'bg-ink-mute/50',
  RESPONDED: 'bg-sky-deep/60',
  ACCEPTED: 'bg-brand-400',
  IN_PROGRESS: 'bg-sun',
  COMPLETED: 'bg-brand-700',
  CANCELLED: 'bg-line',
  DECLINED: 'bg-clay/70',
};

export function AdminDashboardPage() {
  useDocumentTitle('Admin overview');
  const dashboard = useQuery({
    queryKey: queryKeys.adminDashboard,
    queryFn: () => api.get<AdminDashboardDto>('/admin/dashboard'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Approvals, reports, and account activity across AyosDito. Decisions recorded here are written to the audit log with your administrator account."
        actions={
          <>
            <Link
              to="/admin/providers?status=PENDING"
              className={buttonStyles({ variant: 'secondary', size: 'md' })}
            >
              <Store className="h-4 w-4" aria-hidden="true" />
              Provider approvals
            </Link>
            <Link
              to="/admin/reports?status=OPEN"
              className={buttonStyles({ variant: 'primary', size: 'md' })}
            >
              <Flag className="h-4 w-4" aria-hidden="true" />
              Reports queue
            </Link>
          </>
        }
      />

      {dashboard.isPending ? (
        <LoadingBlock label="Loading platform overview…" />
      ) : dashboard.isError ? (
        <ErrorState
          message="We could not load the admin overview. Check your connection and try again."
          onRetry={() => dashboard.refetch()}
        />
      ) : (
        <AdminDashboardContent data={dashboard.data} />
      )}

      <p className="text-xs leading-relaxed text-ink-mute">
        Administrative access is enforced by the server on every operation. This console never
        collects uploaded identity documents or payment details.
      </p>
    </div>
  );
}

function AdminDashboardContent({ data }: { data: AdminDashboardDto }) {
  const { counts, requestsByStatus } = data;
  const totalRequests = Object.values(requestsByStatus).reduce((sum, count) => sum + count, 0);
  const maxStatusCount = Math.max(1, ...Object.values(requestsByStatus));

  const platformTotals = [
    { label: 'Customer accounts', value: counts.customers },
    { label: 'Provider accounts', value: counts.providers },
    { label: 'Administrators', value: counts.admins },
    { label: 'Suspended accounts', value: counts.suspendedUsers },
    { label: 'Approved providers', value: counts.approvedProviders },
    { label: 'Visible reviews', value: counts.visibleReviews },
    { label: 'Open requests', value: counts.openRequests },
    { label: 'Completed requests', value: counts.completedRequests },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Pending applications"
          value={counts.pendingProviders}
          hint="Provider profiles awaiting approval"
          icon={Store}
          tone={counts.pendingProviders > 0 ? 'warning' : 'default'}
          to="/admin/providers?status=PENDING"
        />
        <StatCard
          label="Open reports"
          value={counts.openReports}
          hint="Reported providers or reviews"
          icon={Flag}
          tone={counts.openReports > 0 ? 'warning' : 'default'}
          to="/admin/reports?status=OPEN"
        />
        <StatCard
          label="Jobs in progress"
          value={counts.activeJobs}
          hint="Requests marked in progress by providers"
          icon={Wrench}
        />
        <StatCard
          label="Registered users"
          value={counts.users}
          hint="Customers, providers, and admins"
          icon={UsersRound}
          to="/admin/users"
        />
      </div>

      <p className="text-[11px] leading-relaxed text-ink-mute">
        Counts include demo seed records when the demo data is loaded. Demo accounts and providers
        are labeled in the lists.
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="pending-applications-heading" className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="pending-applications-heading" className="text-lg font-extrabold">
                Provider applications
              </h2>
              <p className="mt-0.5 text-xs text-ink-mute">
                Oldest pending applications. Approval is separate from verification.
              </p>
            </div>
            <Link
              to="/admin/providers?status=PENDING"
              className={buttonStyles({ variant: 'link', size: 'sm', className: 'shrink-0' })}
            >
              Open queue
            </Link>
          </div>

          {data.pendingProviders.length === 0 ? (
            <EmptyState
              className="mt-4 border-0 bg-paper/60 py-8"
              title="No applications waiting"
              description="Every provider application has been reviewed. New submissions will appear here."
            />
          ) : (
            <ul className="mt-4 divide-y divide-line/80">
              {data.pendingProviders.map((provider) => (
                <li key={provider.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                      {provider.businessName}
                      {provider.isDemo ? <DemoBadge /> : null}
                    </p>
                    <p className="mt-0.5 break-all text-xs text-ink-mute">
                      {provider.user.fullName} · {provider.user.email}
                    </p>
                    {provider.categories.length > 0 ? (
                      <p className="mt-1 text-[11px] text-ink-mute">
                        {provider.categories.slice(0, 2).map((category) => category.name).join(' · ')}
                        {provider.categories.length > 2 ? ` +${provider.categories.length - 2} more` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
                      Submitted
                    </p>
                    <p className="text-xs font-semibold text-ink">{formatDate(provider.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="open-reports-heading" className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="open-reports-heading" className="text-lg font-extrabold">
                Reports to review
              </h2>
              <p className="mt-0.5 text-xs text-ink-mute">
                Reports do not remove content automatically. Each decision needs a note.
              </p>
            </div>
            <Link
              to="/admin/reports?status=OPEN"
              className={buttonStyles({ variant: 'link', size: 'sm', className: 'shrink-0' })}
            >
              Open queue
            </Link>
          </div>

          {data.openReports.length === 0 ? (
            <EmptyState
              className="mt-4 border-0 bg-paper/60 py-8"
              title="No open reports"
              description="Nothing is waiting in the moderation queue right now."
            />
          ) : (
            <ul className="mt-4 divide-y divide-line/80">
              {data.openReports.map((report) => (
                <li key={report.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ReportStatusBadge status={report.status} />
                    <span className="text-xs font-semibold text-ink">
                      {REPORT_REASON_LABELS[report.reason]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {report.targetPreview?.label ?? 'Reported content is no longer available'}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
                    {truncate(report.description, 140)}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-mute">
                    Reported by {report.reporter.fullName} · {formatDate(report.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="request-pipeline-heading" className="card-surface p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="request-pipeline-heading" className="text-lg font-extrabold">
                Request pipeline
              </h2>
              <p className="mt-0.5 text-xs text-ink-mute">
                Every service request by its current status.
              </p>
            </div>
            <p className="text-xs font-semibold text-ink-soft">
              {totalRequests} {totalRequests === 1 ? 'request' : 'requests'} total
            </p>
          </div>

          <ul className="mt-5 space-y-3.5">
            {REQUEST_STATUSES.map((status) => {
              const count = requestsByStatus[status];
              const width = count === 0 ? 0 : Math.max(4, Math.round((count / maxStatusCount) * 100));
              return (
                <li key={status}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-ink-soft">{REQUEST_STATUS_LABELS[status]}</span>
                    <span className="font-extrabold text-ink">{count}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper-deep" aria-hidden="true">
                    <div
                      className={cn('h-full rounded-full', PIPELINE_TONES[status])}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="platform-totals-heading" className="card-surface p-5">
          <h2 id="platform-totals-heading" className="text-lg font-extrabold">
            Platform totals
          </h2>
          <p className="mt-0.5 text-xs text-ink-mute">Current database records, not estimates.</p>
          <dl className="mt-4 grid grid-cols-2 gap-2.5">
            {platformTotals.map((item) => (
              <div key={item.label} className="rounded-xl border border-line bg-paper px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-ink-mute">
                  {item.label}
                </dt>
                <dd className="mt-1 text-xl font-extrabold tracking-tight text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section aria-labelledby="recent-activity-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 id="recent-activity-heading" className="text-lg font-extrabold">
              Recent administrator activity
            </h2>
            <p className="mt-0.5 text-xs text-ink-mute">
              The latest eight decisions and changes recorded by the server.
            </p>
          </div>
          <Link
            to="/admin/audit"
            className={buttonStyles({ variant: 'link', size: 'sm', className: 'shrink-0' })}
          >
            Full audit log
          </Link>
        </div>

        <div className="card-surface p-5">
          {data.recentAudit.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-mute">
              No administrative actions have been recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-line/80">
              {data.recentAudit.map((log) => (
                <AuditEntry key={log.id} log={log} compact />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

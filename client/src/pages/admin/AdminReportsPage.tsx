import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Flag, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminReportDto } from '@shared/api-types';
import { REPORT_REASON_LABELS, REPORT_STATUSES } from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { errorMessage, parseAdminFilter } from '@/lib/admin';
import { formatDateTime, pluralize, truncate } from '@/lib/format';
import { useAdminListParams } from '@/hooks/adminList';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { AdminFilterTabs } from '@/components/admin/AdminFilters';
import { ReportEntityBadge, ReportStatusBadge } from '@/components/admin/AdminBadges';

type Decision = 'RESOLVED' | 'DISMISSED';

const STATUS_TABS = [
  { value: 'ALL', label: 'All reports' },
  { value: 'OPEN', label: 'Open' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

export function AdminReportsPage() {
  useDocumentTitle('Reports queue');
  const queryClient = useQueryClient();
  const { params, page, update, reset } = useAdminListParams();
  const status = parseAdminFilter(params.get('status'), REPORT_STATUSES);

  const [action, setAction] = useState<{ report: AdminReportDto; decision: Decision } | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const reports = useQuery({
    queryKey: queryKeys.adminReports({ status, page }),
    queryFn: () =>
      api.list<AdminReportDto>('/admin/reports', {
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize: 20,
      }),
  });

  const closeMutation = useMutation({
    mutationFn: (input: { reportId: string; status: Decision; resolutionNote: string }) =>
      api.patch<AdminReportDto>(`/admin/reports/${input.reportId}`, {
        status: input.status,
        resolutionNote: input.resolutionNote,
      }),
    onSuccess: async (_data, input) => {
      toast.success(
        input.status === 'RESOLVED'
          ? 'Report resolved and closed.'
          : 'Report dismissed. The content was not changed by this action.',
      );
      setAction(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard }),
      ]);
    },
    onError: (error) => setFormError(errorMessage(error, 'Could not close this report.')),
  });

  function openDecision(report: AdminReportDto, decision: Decision) {
    setAction({ report, decision });
    setResolutionNote('');
    setFormError(null);
  }

  function submitDecision(event: React.FormEvent) {
    event.preventDefault();
    if (!action) return;
    const trimmed = resolutionNote.trim();
    if (trimmed.length < 3) {
      setFormError('Add a short resolution note (at least 3 characters).');
      return;
    }
    setFormError(null);
    closeMutation.mutate({
      reportId: action.report.id,
      status: action.decision,
      resolutionNote: trimmed,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Trust and safety"
        title="Reports queue"
        description="Reports about providers and reviews submitted by signed-in users. A report does not remove content automatically; close it with a note explaining what was done."
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <AdminFilterTabs
          label="Filter reports by status"
          options={STATUS_TABS}
          value={status}
          onChange={(value) => update({ status: value === 'ALL' ? null : value })}
        />
        <p className="text-xs text-ink-mute">Oldest open reports appear first.</p>
      </div>

      {reports.isPending ? (
        <LoadingBlock label="Loading reports…" />
      ) : reports.isError ? (
        <ErrorState
          message="We could not load reports. Check your connection and try again."
          onRetry={() => reports.refetch()}
        />
      ) : reports.data.data.length === 0 ? (
        <EmptyState
          icon={<Flag className="h-5 w-5" aria-hidden="true" />}
          title={status === 'ALL' ? 'No reports yet' : 'No reports with this status'}
          description={
            status === 'OPEN'
              ? 'The moderation queue is clear. New reports from customers and providers will appear here.'
              : 'Try another status filter or show all reports.'
          }
          action={
            status !== 'ALL' ? (
              <Button variant="secondary" onClick={reset}>
                Show all reports
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-mute">
              {pluralize(reports.data.meta.total, 'report')}
            </p>
            <Badge variant="outline">
              Page {reports.data.meta.page} of {Math.max(1, reports.data.meta.totalPages)}
            </Badge>
          </div>

          <div className="space-y-3">
            {reports.data.data.map((report) => (
              <article key={report.id} className="card-surface p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ReportEntityBadge entityType={report.entityType} />
                      <ReportStatusBadge status={report.status} />
                      <Badge variant="outline">{REPORT_REASON_LABELS[report.reason]}</Badge>
                    </div>
                    <p className="mt-2 text-[11px] text-ink-mute">
                      Reported {formatDateTime(report.createdAt)} by {report.reporter.fullName} ·{' '}
                      <span className="break-all">{report.reporter.email}</span>
                    </p>
                  </div>
                  {report.status === 'OPEN' ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openDecision(report, 'DISMISSED')}
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        Dismiss
                      </Button>
                      <Button size="sm" onClick={() => openDecision(report, 'RESOLVED')}>
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Resolve
                      </Button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 rounded-xl border border-line bg-paper px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                    Reported target
                  </p>
                  {report.targetPreview ? (
                    <>
                      <p className="mt-1 text-sm font-bold text-ink">{report.targetPreview.label}</p>
                      {report.targetPreview.detail ? (
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
                          {truncate(report.targetPreview.detail, 280)}
                        </p>
                      ) : null}
                      {report.entityType === 'PROVIDER' ? (
                        <Link
                          to={`/providers/${report.entityId}`}
                          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 underline underline-offset-2"
                        >
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          Open public profile
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 text-xs italic text-ink-mute">
                      The reported content is no longer available.
                    </p>
                  )}
                </div>

                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                    Reporter’s explanation
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                    {report.description}
                  </p>
                </div>

                {report.status !== 'OPEN' ? (
                  <div className="mt-3 rounded-xl border border-line/80 bg-paper-soft px-3.5 py-3 text-xs text-ink-soft">
                    <p className="font-semibold text-ink">
                      {report.status === 'RESOLVED' ? 'Resolved' : 'Dismissed'}
                      {report.reviewedBy ? ` by ${report.reviewedBy.fullName}` : ''}
                      {report.reviewedAt ? ` · ${formatDateTime(report.reviewedAt)}` : ''}
                    </p>
                    {report.resolutionNote ? (
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{report.resolutionNote}</p>
                    ) : (
                      <p className="mt-1 italic text-ink-mute">No resolution note recorded.</p>
                    )}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <Pagination
            page={reports.data.meta.page}
            pageSize={reports.data.meta.pageSize}
            total={reports.data.meta.total}
            totalPages={reports.data.meta.totalPages}
            onPageChange={(nextPage) => {
              update({ page: String(nextPage) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">Closing a report is not content removal</p>
        <p className="mt-2">
          To hide a review, use review moderation. To address a provider, review their application
          or suspend the account. Closing a report only records your decision and note; take the
          separate action first when the report is valid.
        </p>
      </div>

      <Dialog
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !closeMutation.isPending) setAction(null);
        }}
        title={
          !action
            ? ''
            : action.decision === 'RESOLVED'
              ? 'Resolve this report?'
              : 'Dismiss this report?'
        }
        description={
          !action
            ? undefined
            : action.decision === 'RESOLVED'
              ? 'Use this after taking the appropriate action. The report is closed as resolved.'
              : 'Use this when the report does not require action. Closing it does not change the reported content.'
        }
      >
        {action ? (
          <form id="report-decision-form" onSubmit={submitDecision} className="space-y-4">
            {formError ? <Alert tone="error">{formError}</Alert> : null}

            <div className="rounded-xl border border-line bg-paper px-3.5 py-3 text-xs text-ink-soft">
              <div className="flex flex-wrap items-center gap-1.5">
                <ReportEntityBadge entityType={action.report.entityType} />
                <Badge variant="outline">{REPORT_REASON_LABELS[action.report.reason]}</Badge>
              </div>
              <p className="mt-1.5 font-semibold text-ink">
                {action.report.targetPreview?.label ?? 'Reported content no longer available'}
              </p>
            </div>

            {action.decision === 'RESOLVED' ? (
              <Alert tone="info">
                Confirm that the necessary action was taken outside this decision, such as hiding a
                review or contacting the provider. The note below is the record of what happened.
              </Alert>
            ) : null}

            <Field
              id="report-resolution-note"
              label="Resolution note"
              required
              hint="3–500 characters. Visible to administrators in the report history and audit log."
            >
              <Textarea
                id="report-resolution-note"
                rows={3}
                maxLength={500}
                value={resolutionNote}
                onChange={(event) => setResolutionNote(event.target.value)}
                placeholder={
                  action.decision === 'RESOLVED'
                    ? 'Example: Review hidden for including private contact details; provider reminded not to ask for off-platform payment.'
                    : 'Example: The reported profile and listing match the records we can verify. No policy violation found.'
                }
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAction(null)}
                disabled={closeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={action.decision === 'RESOLVED' ? 'primary' : 'secondary'}
                loading={closeMutation.isPending}
              >
                {action.decision === 'RESOLVED' ? 'Resolve report' : 'Dismiss report'}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}

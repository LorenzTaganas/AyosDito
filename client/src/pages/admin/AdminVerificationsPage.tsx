import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  ShieldCheck,
  ShieldX,
  UserRoundCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AdminVerificationDto } from '@shared/api-types';
import {
  VERIFICATION_REVIEW_STATUSES,
  VERIFICATION_TYPE_LABELS,
} from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { errorMessage, parseAdminFilter } from '@/lib/admin';
import { formatDateTime, pluralize } from '@/lib/format';
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
import { ApprovalStatusBadge, VerificationReviewBadge } from '@/components/admin/AdminBadges';

type Decision = 'APPROVED' | 'REJECTED';

const STATUS_TABS = [
  { value: 'ALL', label: 'All requests' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function AdminVerificationsPage() {
  useDocumentTitle('Verification requests');
  const queryClient = useQueryClient();
  const { params, page, update, reset } = useAdminListParams();
  const status = parseAdminFilter(params.get('status'), VERIFICATION_REVIEW_STATUSES);

  const [target, setTarget] = useState<{ verification: AdminVerificationDto; decision: Decision } | null>(
    null,
  );
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const verifications = useQuery({
    queryKey: queryKeys.adminVerifications({ status, page }),
    queryFn: () =>
      api.list<AdminVerificationDto>('/admin/verifications', {
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize: 20,
      }),
  });

  const decisionMutation = useMutation({
    mutationFn: (input: { verificationId: string; status: Decision; reviewNote?: string }) =>
      api.patch<AdminVerificationDto>(`/admin/verifications/${input.verificationId}`, {
        status: input.status,
        reviewNote: input.reviewNote,
      }),
    onSuccess: async (_data, input) => {
      toast.success(
        input.status === 'APPROVED'
          ? 'Verification approved. The public badge is now active.'
          : 'Verification request rejected. The provider can see your review note.',
      );
      setTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['providers'] }),
      ]);
    },
    onError: (error) => setFormError(errorMessage(error, 'Could not review this verification request.')),
  });

  function openDecision(verification: AdminVerificationDto, decision: Decision) {
    setTarget({ verification, decision });
    setNote('');
    setConfirmed(false);
    setFormError(null);
  }

  function submitDecision(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    const trimmed = note.trim();

    if (target.decision === 'APPROVED') {
      if (target.verification.provider.approvalStatus !== 'APPROVED') {
        setFormError('Approve the provider application before granting a verification badge.');
        return;
      }
      if (!confirmed) {
        setFormError('Confirm that you completed the verification check outside the app.');
        return;
      }
    } else if (trimmed.length < 10) {
      setFormError('Explain why the request was rejected (at least 10 characters).');
      return;
    }

    setFormError(null);
    decisionMutation.mutate({
      verificationId: target.verification.id,
      status: target.decision,
      reviewNote: trimmed || undefined,
    });
  }

  const providerApproved = target?.verification.provider.approvalStatus === 'APPROVED';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Trust and safety"
        title="Verification requests"
        description="Identity and business checks submitted by providers. A badge is granted only after an administrator completes the check outside AyosDito and records the decision here."
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <AdminFilterTabs
          label="Filter verification requests by status"
          options={STATUS_TABS}
          value={status}
          onChange={(value) => update({ status: value === 'ALL' ? null : value })}
        />
        <p className="text-xs text-ink-mute">
          This app does not accept or store uploaded identity documents.
        </p>
      </div>

      {verifications.isPending ? (
        <LoadingBlock label="Loading verification requests…" />
      ) : verifications.isError ? (
        <ErrorState
          message="We could not load verification requests. Check your connection and try again."
          onRetry={() => verifications.refetch()}
        />
      ) : verifications.data.data.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          title="No verification requests here"
          description={
            status === 'ALL'
              ? 'Providers can request an identity or business check from their dashboard. Requests will appear here for review.'
              : 'No requests currently have this review status.'
          }
          action={
            status !== 'ALL' ? (
              <Button variant="secondary" onClick={reset}>
                Show all requests
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-mute">
              {pluralize(verifications.data.meta.total, 'request')}
            </p>
            <Badge variant="outline">
              Page {verifications.data.meta.page} of {Math.max(1, verifications.data.meta.totalPages)}
            </Badge>
          </div>

          <div className="space-y-3">
            {verifications.data.data.map((verification) => {
              const isIdentity = verification.verificationType === 'IDENTITY';
              const TypeIcon = isIdentity ? UserRoundCheck : Building2;
              const pending = verification.status === 'PENDING';
              const canApprove = pending && verification.provider.approvalStatus === 'APPROVED';
              return (
                <article key={verification.id} className="card-surface p-4 sm:p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-700">
                          <TypeIcon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-ink">
                            {VERIFICATION_TYPE_LABELS[verification.verificationType]}
                          </h2>
                          <p className="text-xs text-ink-mute">
                            Submitted {formatDateTime(verification.createdAt)}
                          </p>
                        </div>
                        <VerificationReviewBadge status={verification.status} />
                      </div>

                      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-ink">{verification.provider.businessName}</span>
                        <ApprovalStatusBadge status={verification.provider.approvalStatus} />
                      </p>

                      <div className="mt-3 rounded-xl border border-line bg-paper px-3.5 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                          What the provider says they can present
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                          {verification.note}
                        </p>
                      </div>

                      {verification.status !== 'PENDING' ? (
                        <div className="mt-3 rounded-xl border border-line/80 bg-paper-soft px-3.5 py-3 text-xs text-ink-soft">
                          <p className="font-semibold text-ink">
                            {verification.status === 'APPROVED' ? 'Approved' : 'Rejected'} by{' '}
                            {verification.reviewedByName ?? 'an administrator'}
                            {verification.reviewedAt ? ` on ${formatDateTime(verification.reviewedAt)}` : ''}
                          </p>
                          {verification.reviewNote ? (
                            <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                              {verification.reviewNote}
                            </p>
                          ) : (
                            <p className="mt-1 italic text-ink-mute">No reviewer note was recorded.</p>
                          )}
                        </div>
                      ) : null}

                      {pending && !canApprove ? (
                        <div className="mt-3">
                          <Alert tone="warning" title="Provider application is not approved">
                            A verification badge cannot be approved until the provider application
                            is approved. Review the application first, then return to this request.
                            <span className="mt-1 block">
                              <Link
                                to={`/admin/providers?q=${encodeURIComponent(verification.provider.businessName)}`}
                                className="font-semibold underline underline-offset-2"
                              >
                                Open provider application
                              </Link>
                            </span>
                          </Alert>
                        </div>
                      ) : null}
                    </div>

                    {pending ? (
                      <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[12rem] lg:flex-col lg:items-stretch">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={!canApprove}
                          title={
                            canApprove
                              ? 'Approve after completing the check outside the app'
                              : 'Approve the provider application first'
                          }
                          onClick={() => openDecision(verification, 'APPROVED')}
                        >
                          <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                          Approve check
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-clay"
                          onClick={() => openDecision(verification, 'REJECTED')}
                        >
                          <ShieldX className="h-3.5 w-3.5" aria-hidden="true" />
                          Reject request
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <Pagination
            page={verifications.data.meta.page}
            pageSize={verifications.data.meta.pageSize}
            total={verifications.data.meta.total}
            totalPages={verifications.data.meta.totalPages}
            onPageChange={(nextPage) => {
              update({ page: String(nextPage) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">How badges stay truthful</p>
        <p className="mt-2">
          A badge is a record of an administrator’s review, not an automatic result of registration.
          Complete a real identity or business check outside this app before approving. The app only
          stores the provider’s statement, the decision, the reviewer, and the review note.
        </p>
      </div>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !decisionMutation.isPending) setTarget(null);
        }}
        title={
          !target
            ? ''
            : target.decision === 'APPROVED'
              ? `Approve ${VERIFICATION_TYPE_LABELS[target.verification.verificationType].toLowerCase()}?`
              : `Reject ${VERIFICATION_TYPE_LABELS[target.verification.verificationType].toLowerCase()} request?`
        }
        description={
          !target
            ? undefined
            : target.decision === 'APPROVED'
              ? `This adds a public verification badge to ${target.verification.provider.businessName}.`
              : `The provider will see your review note and can submit a new request later if appropriate.`
        }
      >
        {target ? (
          <form id="verification-decision-form" onSubmit={submitDecision} className="space-y-4">
            {formError ? <Alert tone="error">{formError}</Alert> : null}

            <div className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs text-ink-soft">
              <p className="font-semibold text-ink">{target.verification.provider.businessName}</p>
              <p className="mt-0.5">
                {VERIFICATION_TYPE_LABELS[target.verification.verificationType]} ·{' '}
                {formatDateTime(target.verification.createdAt)}
              </p>
            </div>

            {target.decision === 'APPROVED' ? (
              <>
                {!providerApproved ? (
                  <Alert tone="warning">
                    The provider application is still {target.verification.provider.approvalStatus.toLowerCase()}.
                    Approve the application before granting a badge.
                  </Alert>
                ) : null}
                <Alert tone="warning" title="Complete the check outside this app">
                  AyosDito does not collect or store identity documents. Only approve if you have
                  completed an appropriate verification process through your organization’s official
                  channels and are satisfied that the provider’s identity or business details are
                  genuine.
                </Alert>
                <label className="flex items-start gap-2.5 rounded-xl border border-line bg-paper-soft p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 focus:ring-brand-600"
                  />
                  <span className="leading-relaxed text-ink-soft">
                    I completed the check and confirm that this badge is supported by a real review.
                  </span>
                </label>
              </>
            ) : null}

            <Field
              id="verification-review-note"
              label={
                target.decision === 'APPROVED' ? 'Reviewer note (optional)' : 'Reason for rejection'
              }
              required={target.decision === 'REJECTED'}
              hint={
                target.decision === 'APPROVED'
                  ? 'Stored with the decision. Do not include ID numbers or other sensitive document details.'
                  : '10–500 characters. The provider can see this note. Do not include private document details.'
              }
            >
              <Textarea
                id="verification-review-note"
                rows={3}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={
                  target.decision === 'APPROVED'
                    ? 'Example: Checked against the business permit presented at the barangay office.'
                    : 'Example: The submitted details could not be matched to a business record. Please provide matching details and resubmit.'
                }
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setTarget(null)}
                disabled={decisionMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={target.decision === 'APPROVED' ? 'primary' : 'danger'}
                loading={decisionMutation.isPending}
                disabled={target.decision === 'APPROVED' && !providerApproved}
              >
                {target.decision === 'APPROVED' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Approve badge
                  </>
                ) : (
                  'Reject request'
                )}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Building2, CalendarDays, ExternalLink, MailCheck, MailX, MapPin, Store } from 'lucide-react';
import { toast } from 'sonner';
import type { AdminProviderDto } from '@shared/api-types';
import { PROVIDER_APPROVAL_STATUSES } from '@shared/contracts';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { errorMessage, parseAdminFilter } from '@/lib/admin';
import { formatDate, locationLabel, pluralize, truncate } from '@/lib/format';
import { useAdminListParams } from '@/hooks/adminList';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { Rating } from '@/components/ui/Stars';
import { DemoBadge, VerificationBadges } from '@/components/ui/Verification';
import { ApprovalStatusBadge } from '@/components/admin/AdminBadges';
import { AdminFilterTabs, AdminSearch } from '@/components/admin/AdminFilters';

type Decision = 'APPROVED' | 'REJECTED';

const STATUS_TABS = [
  { value: 'ALL', label: 'All applications' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export function AdminProvidersPage() {
  useDocumentTitle('Provider approvals');
  const queryClient = useQueryClient();
  const { params, page, update, reset } = useAdminListParams();
  const q = params.get('q') ?? '';
  const status = parseAdminFilter(params.get('status'), PROVIDER_APPROVAL_STATUSES);

  const [target, setTarget] = useState<{ provider: AdminProviderDto; decision: Decision } | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const providers = useQuery({
    queryKey: queryKeys.adminProviders({ q, status, page }),
    queryFn: () =>
      api.list<AdminProviderDto>('/admin/providers', {
        q: q || undefined,
        status: status === 'ALL' ? undefined : status,
        page,
        pageSize: 20,
      }),
  });

  const decisionMutation = useMutation({
    mutationFn: (input: { providerId: string; approvalStatus: Decision; reason?: string }) =>
      api.patch<AdminProviderDto>(`/admin/providers/${input.providerId}/approval`, {
        approvalStatus: input.approvalStatus,
        reason: input.reason,
      }),
    onSuccess: async (_data, input) => {
      toast.success(
        input.approvalStatus === 'APPROVED'
          ? 'Provider approved. Their profile is now in the public directory.'
          : 'Provider rejected. Their public profile is no longer listed.',
      );
      setTarget(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminDashboard }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'verifications'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
        queryClient.invalidateQueries({ queryKey: ['providers'] }),
      ]);
    },
    onError: (error) => setFormError(errorMessage(error, 'Could not update this application.')),
  });

  function openDecision(provider: AdminProviderDto, decision: Decision) {
    setTarget({ provider, decision });
    setReason('');
    setFormError(null);
  }

  function submitDecision(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    const trimmed = reason.trim();
    if (target.decision === 'REJECTED' && trimmed.length < 10) {
      setFormError('Give the provider a clear reason (at least 10 characters).');
      return;
    }
    setFormError(null);
    decisionMutation.mutate({
      providerId: target.provider.id,
      approvalStatus: target.decision,
      reason: target.decision === 'REJECTED' ? trimmed : undefined,
    });
  }

  const hasFilters = Boolean(q) || status !== 'ALL';
  const revoking = target?.provider.approvalStatus === 'APPROVED' && target.decision === 'REJECTED';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Provider management"
        title="Applications and approvals"
        description="Approval makes a provider eligible to appear in the public directory and send quotes. It never grants a verification badge by itself."
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <AdminFilterTabs
          label="Filter providers by approval status"
          options={STATUS_TABS}
          value={status}
          onChange={(value) => update({ status: value === 'ALL' ? null : value })}
        />
        <AdminSearch placeholder="Search business, owner, or email" label="Search providers" />
      </div>

      {providers.isPending ? (
        <LoadingBlock label="Loading provider applications…" />
      ) : providers.isError ? (
        <ErrorState
          message="We could not load provider applications. Check your connection and try again."
          onRetry={() => providers.refetch()}
        />
      ) : providers.data.data.length === 0 ? (
        <EmptyState
          icon={<Store className="h-5 w-5" aria-hidden="true" />}
          title="No applications match these filters"
          description={
            hasFilters
              ? 'Try a different approval status or search term, or clear the filters.'
              : 'When a customer registers as a provider, their application appears here.'
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={reset}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink-mute">
              {pluralize(providers.data.meta.total, 'application')}
              {q ? ` · matching “${q}”` : ''}
            </p>
            <Badge variant="outline">
              Page {providers.data.meta.page} of {Math.max(1, providers.data.meta.totalPages)}
            </Badge>
          </div>

          <div className="space-y-3">
            {providers.data.data.map((provider) => (
              <article key={provider.id} className="card-surface p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 gap-3">
                    <Avatar
                      name={provider.businessName}
                      imageUrl={provider.profileImage}
                      size="md"
                      className="hidden sm:grid"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h2 className="text-base font-bold text-ink">{provider.businessName}</h2>
                        {provider.isDemo ? <DemoBadge /> : null}
                        <ApprovalStatusBadge status={provider.approvalStatus} />
                      </div>

                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                        <span className="font-semibold">{provider.user.fullName}</span>
                        <span className="break-all text-ink-mute">{provider.user.email}</span>
                        <Badge variant={provider.user.emailVerified ? 'outline' : 'danger'}>
                          {provider.user.emailVerified ? (
                            <MailCheck className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <MailX className="h-3 w-3" aria-hidden="true" />
                          )}
                          {provider.user.emailVerified ? 'Email verified' : 'Email unverified'}
                        </Badge>
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <VerificationBadges
                          identityVerified={provider.identityVerified}
                          businessVerified={provider.businessVerified}
                          compact
                        />
                        <Rating rating={provider.ratingAvg} count={provider.reviewCount} />
                      </div>

                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                        {truncate(provider.description, 240) || 'No business description provided yet.'}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {provider.categories.length > 0 ? (
                          provider.categories.map((category) => (
                            <span
                              key={category.id}
                              className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-[11px] font-semibold text-ink-soft"
                            >
                              <Building2 className="h-3 w-3 text-brand-600" aria-hidden="true" />
                              {category.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] italic text-ink-mute">No categories listed</span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-mute">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-brand-600" aria-hidden="true" />
                          {provider.serviceAreas.length > 0
                            ? provider.serviceAreas.slice(0, 3).map(locationLabel).join(' · ')
                            : 'No service areas listed'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" aria-hidden="true" />
                          Registered {formatDate(provider.createdAt)}
                        </span>
                        {provider.yearsOfExperience ? (
                          <span>{pluralize(provider.yearsOfExperience, 'year')} of experience (self-reported)</span>
                        ) : null}
                      </div>

                      {provider.approvalStatus === 'REJECTED' && provider.rejectionReason ? (
                        <div className="mt-3">
                          <Alert tone="error" title="Rejection reason recorded">
                            {provider.rejectionReason}
                          </Alert>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[13rem] lg:flex-col lg:items-stretch">
                    {provider.approvalStatus !== 'APPROVED' ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openDecision(provider, 'APPROVED')}
                      >
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Approve provider
                      </Button>
                    ) : (
                      <Link
                        to={`/providers/${provider.id}`}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-line bg-paper-soft px-3 text-sm font-semibold text-ink transition hover:border-brand-300 hover:bg-brand-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        View public profile
                      </Link>
                    )}
                    {provider.approvalStatus !== 'REJECTED' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-clay"
                        onClick={() => openDecision(provider, 'REJECTED')}
                      >
                        {provider.approvalStatus === 'APPROVED' ? 'Revoke approval' : 'Reject application'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Pagination
            page={providers.data.meta.page}
            pageSize={providers.data.meta.pageSize}
            total={providers.data.meta.total}
            totalPages={providers.data.meta.totalPages}
            onPageChange={(nextPage) => {
              update({ page: String(nextPage) });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}

      <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
        <p className="font-bold text-ink">Approval is not verification</p>
        <p className="mt-2">
          Anyone can register a provider account. Approval only confirms that the profile can be
          listed; it does not mean the person or business was checked. Verification badges require a
          separate administrator review. Rejecting an application hides the public profile and
          records your reason for the provider.
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
              ? `Approve ${target.provider.businessName}?`
              : revoking
                ? `Revoke approval for ${target.provider.businessName}?`
                : `Reject ${target.provider.businessName}?`
        }
        description={
          !target
            ? undefined
            : target.decision === 'APPROVED'
              ? 'The profile becomes eligible for the public directory and for sending quotes on matching requests.'
              : 'The public profile is hidden and the provider cannot send new quotes. Existing requests, quotes, and reviews are not deleted.'
        }
      >
        {target ? (
          <form id="provider-decision-form" onSubmit={submitDecision} className="space-y-4">
            {formError ? <Alert tone="error">{formError}</Alert> : null}

            {target.decision === 'APPROVED' ? (
              <Alert tone="info" title="No verification badge is added">
                Approving this application does not verify the owner’s identity or the business. A
                verification badge appears only after a separate verification request is reviewed
                and approved.
              </Alert>
            ) : (
              <>
                <div className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs text-ink-soft">
                  <p className="font-semibold text-ink">{target.provider.businessName}</p>
                  <p className="mt-0.5 break-all">
                    {target.provider.user.fullName} · {target.provider.user.email}
                  </p>
                </div>
                <Field
                  id="provider-rejection-reason"
                  label="Reason shown to the provider"
                  required
                  hint="10–500 characters. The provider sees this on their dashboard. Do not include private personal information."
                >
                  <Textarea
                    id="provider-rejection-reason"
                    rows={4}
                    maxLength={500}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Example: The business description and service areas do not match the services listed. Please update them and resubmit for review."
                  />
                </Field>
              </>
            )}

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
              >
                {target.decision === 'APPROVED'
                  ? 'Approve provider'
                  : revoking
                    ? 'Revoke approval'
                    : 'Reject application'}
              </Button>
            </div>
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}

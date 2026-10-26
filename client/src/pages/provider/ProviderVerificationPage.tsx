import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Building2,
  Clock,
  ShieldCheck,
  ShieldX,
  UserRoundCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProviderSelf, ProviderVerificationDto } from '@shared/api-types';
import { VERIFICATION_TYPES, type VerificationType } from '@shared/contracts';
import { api, fieldErrorsFrom } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { formatDateTime, pluralize } from '@/lib/format';
import { PageHeader } from '@/components/ui/Brand';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Field, Textarea } from '@/components/ui/Field';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { DemoBadge, VerificationBadges } from '@/components/ui/Verification';

const TYPE_LABELS: Record<VerificationType, string> = {
  IDENTITY: 'Identity check',
  BUSINESS: 'Business check',
};

function statusTone(status: ProviderVerificationDto['status']): 'sun' | 'brand' | 'danger' {
  if (status === 'APPROVED') return 'brand';
  if (status === 'REJECTED') return 'danger';
  return 'sun';
}

export function ProviderVerificationPage() {
  useDocumentTitle('Verification');
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const self = useQuery({
    queryKey: queryKeys.providerSelf,
    queryFn: () => api.get<ProviderSelf>('/providers/me'),
  });

  const [verificationType, setVerificationType] = useState<VerificationType>('IDENTITY');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const provider = self.data;
  const verificationRequests = provider?.verificationRequests ?? [];
  const pendingForType = verificationRequests.some(
    (request) => request.verificationType === verificationType && request.status === 'PENDING',
  );
  const verifiedForType =
    verificationType === 'IDENTITY' ? Boolean(provider?.identityVerified) : Boolean(provider?.businessVerified);
  const bothVerified = Boolean(provider?.identityVerified && provider?.businessVerified);
  const approved = provider?.approvalStatus === 'APPROVED';

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!approved) {
      setError('Your provider profile must be approved before you can request verification.');
      return;
    }
    if (verifiedForType) {
      setError('This verification is already complete.');
      return;
    }
    if (pendingForType) {
      setError('A request for this verification is already pending.');
      return;
    }
    const trimmed = note.trim();
    if (trimmed.length < 20) {
      setError('Describe the documents or details you can present in at least 20 characters.');
      return;
    }
    if (trimmed.length > 1000) {
      setError('Keep the description under 1,000 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post<ProviderVerificationDto>('/providers/me/verifications', {
        verificationType,
        note: trimmed,
      });
      setNote('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.providerSelf }),
        queryClient.invalidateQueries({ queryKey: queryKeys.providerDashboard }),
      ]);
      await refresh();
      toast.success('Verification request submitted for administrator review.');
    } catch (requestError) {
      const mapped = fieldErrorsFrom(requestError);
      setError(
        mapped?.note ??
          mapped?.verificationType ??
          (requestError instanceof Error ? requestError.message : 'Could not submit the request.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (self.isPending) {
    return <LoadingBlock label="Loading your verification status…" />;
  }

  if (self.isError || !provider) {
    return (
      <ErrorState
        message="We could not load your verification status. Check your connection and try again."
        onRetry={() => self.refetch()}
      />
    );
  }

  const pendingRequests = verificationRequests.filter((request) => request.status === 'PENDING');

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Verification"
        title="Verification requests"
        description="Verification badges are optional and reviewed by an administrator. Being an approved provider does not automatically verify your identity or business."
        actions={
          <Link
            to={`/providers/${provider.id}`}
            className="text-xs font-semibold text-brand-800 underline underline-offset-2"
          >
            View public profile
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper-soft px-4 py-3 text-xs text-ink-soft">
        <span className="font-semibold text-ink">Current status</span>
        <VerificationBadges
          identityVerified={provider.identityVerified}
          businessVerified={provider.businessVerified}
        />
        <span className="text-ink-mute">·</span>
        <Badge
          variant={
            provider.approvalStatus === 'APPROVED'
              ? 'brand'
              : provider.approvalStatus === 'REJECTED'
                ? 'danger'
                : 'sun'
          }
        >
          {provider.approvalStatus === 'APPROVED'
            ? 'Provider approved'
            : provider.approvalStatus === 'REJECTED'
              ? 'Provider needs changes'
              : 'Provider under review'}
        </Badge>
        {provider.isDemo ? <DemoBadge label="Demo provider" /> : null}
      </div>

      {!approved ? (
        <Alert
          tone={provider.approvalStatus === 'REJECTED' ? 'error' : 'warning'}
          title="Verification opens after provider approval"
        >
          <p>
            An administrator must approve your provider profile before you can submit an identity or
            business verification request. You can{' '}
            <Link to="/provider/profile" className="font-semibold underline underline-offset-2">
              update your profile
            </Link>{' '}
            now.
          </p>
        </Alert>
      ) : null}

      {pendingRequests.length > 0 ? (
        <Alert tone="info" title="You have a request under review">
          {pluralize(pendingRequests.length, 'verification request')} {pendingRequests.length === 1 ? 'is' : 'are'}{' '}
          waiting for an administrator. You will see the decision in the history below.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="card-surface p-5 sm:p-6" aria-labelledby="verification-form-heading">
            <h2 id="verification-form-heading" className="flex items-center gap-2 text-base font-extrabold">
              <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
              Submit a verification request
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-mute">
              Choose one check at a time. An administrator reviews the request and approves or
              rejects it. A badge appears on your public profile only after that review.
            </p>

            {bothVerified ? (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
                <p className="flex items-center gap-2 font-bold">
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  Both checks are complete
                </p>
                <p className="mt-1 text-xs leading-relaxed">
                  Your identity and business checks were approved by an administrator. Badges remain
                  visible while your profile is listed. If your business details change
                  substantially, contact an administrator.
                </p>
              </div>
            ) : (
              <form onSubmit={submitRequest} className="mt-4 space-y-4" noValidate>
                {error ? <Alert tone="error">{error}</Alert> : null}

                <fieldset>
                  <legend className="field-label">What are you verifying?</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {VERIFICATION_TYPES.map((type) => {
                      const isIdentity = type === 'IDENTITY';
                      const alreadyVerified = isIdentity
                        ? provider.identityVerified
                        : provider.businessVerified;
                      const hasPending = verificationRequests.some(
                        (request) => request.verificationType === type && request.status === 'PENDING',
                      );
                      const disabled = alreadyVerified || hasPending || !approved;
                      const Icon = isIdentity ? UserRoundCheck : Building2;
                      return (
                        <label
                          key={type}
                          className={`flex items-start gap-3 rounded-xl border p-3 text-sm transition ${
                            verificationType === type
                              ? 'border-brand-500 bg-brand-50/60'
                              : 'border-line bg-paper-soft'
                          } ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
                        >
                          <input
                            type="radio"
                            name="verification-type"
                            value={type}
                            checked={verificationType === type}
                            disabled={disabled}
                            onChange={() => {
                              setVerificationType(type);
                              setError(null);
                            }}
                            className="mt-1 h-4 w-4 border-line text-brand-700 focus:ring-brand-600"
                          />
                          <span>
                            <span className="flex items-center gap-1.5 font-semibold">
                              <Icon className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
                              {TYPE_LABELS[type]}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-mute">
                              {alreadyVerified
                                ? 'Already verified.'
                                : hasPending
                                  ? 'A request is pending.'
                                  : isIdentity
                                    ? 'Confirms that the person behind this account matches the provider.'
                                    : 'Confirms that the business name and details belong to a real business.'}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <Field
                  id="verification-note"
                  label="What can you present?"
                  required
                  hint="20–1,000 characters. Describe the type of supporting detail you can show an administrator. Do not paste ID numbers or upload documents."
                >
                  <Textarea
                    id="verification-note"
                    rows={5}
                    maxLength={1000}
                    value={note}
                    disabled={!approved || verifiedForType || pendingForType}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Example: I can present a government-issued ID and a barangay business certificate under the same business name. I can meet an administrator at the shop in Malolos for an in-person check."
                  />
                </Field>

                {verifiedForType ? (
                  <Alert tone="success">
                    {TYPE_LABELS[verificationType]} is already complete. You cannot submit it again.
                  </Alert>
                ) : pendingForType ? (
                  <Alert tone="warning">
                    A {TYPE_LABELS[verificationType].toLowerCase()} request is already pending. Wait
                    for the administrator decision before sending another.
                  </Alert>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={submitting}
                    disabled={!approved || verifiedForType || pendingForType}
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    Submit for review
                  </Button>
                </div>
              </form>
            )}
          </section>

          <section aria-labelledby="verification-history-heading">
            <h2 id="verification-history-heading" className="mb-3 text-lg font-extrabold">
              Request history
            </h2>
            {verificationRequests.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
                title="No verification requests yet"
                description="Identity and business checks are optional. Submit a request when you can present details for an administrator to review."
              />
            ) : (
              <ol className="space-y-3">
                {verificationRequests.map((request) => (
                  <li key={request.id} className="card-surface p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">{TYPE_LABELS[request.verificationType]}</p>
                        <p className="mt-0.5 text-xs text-ink-mute">
                          Submitted {formatDateTime(request.createdAt)}
                        </p>
                      </div>
                      <Badge variant={statusTone(request.status)}>
                        {request.status === 'PENDING'
                          ? 'Pending review'
                          : request.status === 'APPROVED'
                            ? 'Approved'
                            : 'Rejected'}
                      </Badge>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-paper px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
                      {request.note}
                    </p>
                    {request.reviewNote ? (
                      <div
                        className={`mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
                          request.status === 'REJECTED'
                            ? 'bg-clay-soft/60 text-[#8f2f1d]'
                            : 'bg-brand-50 text-brand-900'
                        }`}
                      >
                        <p className="font-bold">Administrator note</p>
                        <p className="mt-1">{request.reviewNote}</p>
                      </div>
                    ) : null}
                    {request.reviewedAt ? (
                      <p className="mt-2 text-[11px] text-ink-mute">
                        Reviewed {formatDateTime(request.reviewedAt)}
                        {request.reviewedByName ? ` by ${request.reviewedByName}` : ''}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card-surface p-5">
            <h2 className="text-sm font-extrabold">What a badge means</h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-soft">
              <li className="flex gap-2">
                <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
                A badge means an administrator approved that specific verification request.
              </li>
              <li className="flex gap-2">
                <ShieldX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clay" aria-hidden="true" />
                It is not a guarantee of work quality, safety, or future behavior.
              </li>
              <li className="flex gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sun-deep" aria-hidden="true" />
                Review times are not guaranteed. You will see the decision here and the badge on your
                public profile.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-clay/20 bg-clay-soft/40 p-4 text-xs leading-relaxed text-[#8f2f1d]">
            <p className="font-bold">No document uploads in this MVP</p>
            <p className="mt-2">
              AyosDito does not store identity documents. Do not paste ID numbers, full document
              images, or other sensitive identifiers into this request. An administrator will
              coordinate any additional check outside the site.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
            <p className="flex items-center gap-1.5 font-bold text-ink">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
              Truthful claims only
            </p>
            <p className="mt-2">
              Do not display verification wording on your own materials before this page shows an
              approved badge. Misrepresenting a verification is misleading to customers and may lead
              to a report.
            </p>
            {user?.isDemo ? (
              <p className="mt-2">
                Demo accounts may include sample verification history. It is not a real check.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

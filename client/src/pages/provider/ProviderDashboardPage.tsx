import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  MessageSquareQuote,
  ShieldCheck,
  Star,
  Wrench,
} from 'lucide-react';
import type { ProviderDashboardDto, ProviderSelf } from '@shared/api-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/Brand';
import { buttonStyles } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { Rating } from '@/components/ui/Stars';
import { DemoBadge, VerificationBadges } from '@/components/ui/Verification';
import { StatCard } from '@/components/dashboard/StatCard';
import { RequestSummaryCard } from '@/components/dashboard/RequestSummaryCard';
import { EmailVerificationNotice } from '@/components/dashboard/EmailVerificationNotice';

const APPROVAL_COPY: Record<
  ProviderDashboardDto['profile']['approvalStatus'],
  { title: string; body: string }
> = {
  PENDING: {
    title: 'Your provider application is under review',
    body: 'An administrator needs to approve your profile before it appears in the public directory and before you can receive or quote on open requests. You can prepare your services, areas, and portfolio while you wait.',
  },
  APPROVED: {
    title: 'Your provider profile is approved',
    body: 'Your active services and service areas are used to match you with open requests. Keep your listings and areas accurate so customers see the right offer.',
  },
  REJECTED: {
    title: 'Your provider application needs changes',
    body: 'Update your business name or description and save the form to send it back for review. You cannot quote on open requests until an administrator approves the updated profile.',
  },
};

export function ProviderDashboardPage() {
  useDocumentTitle('Provider dashboard');
  const { user } = useAuth();

  const dashboard = useQuery({
    queryKey: queryKeys.providerDashboard,
    queryFn: () => api.get<ProviderDashboardDto>('/providers/me/dashboard'),
  });
  const self = useQuery({
    queryKey: queryKeys.providerSelf,
    queryFn: () => api.get<ProviderSelf>('/providers/me'),
  });

  const firstName = user?.fullName.split(' ')[0] ?? 'there';
  const provider = self.data;
  const approvalStatus =
    dashboard.data?.profile.approvalStatus ?? provider?.approvalStatus ?? user?.provider?.approvalStatus ?? 'PENDING';
  const approval = APPROVAL_COPY[approvalStatus];

  const isLoading = dashboard.isPending || self.isPending;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Provider dashboard"
        title={`Kumusta, ${firstName}?`}
        description="Manage the work you can accept, the quotes you have sent, and how your business appears to customers."
        actions={
          <>
            <Link
              to={
                provider ? `/providers/${provider.id}` : '/provider/profile'
              }
              className={buttonStyles({ variant: 'secondary', size: 'md' })}
            >
              {provider ? 'View public profile' : 'Complete your profile'}
            </Link>
            <Link to="/provider/requests" className={buttonStyles({ variant: 'primary', size: 'md' })}>
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              Find work
            </Link>
          </>
        }
      />

      <EmailVerificationNotice />

      {user?.isDemo ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#f0dcaa] bg-sun-soft/50 px-4 py-3 text-xs text-sun-deep">
          <DemoBadge label="Demo provider" />
          <span>
            This business, its services, and its reviews are sample records created by the seed
            script. They are not a real business or real job history.
          </span>
        </div>
      ) : null}

      {approvalStatus !== 'APPROVED' ? (
        <Alert tone={approvalStatus === 'REJECTED' ? 'error' : 'warning'} title={approval.title}>
          <p>{approval.body}</p>
          {provider?.rejectionReason && approvalStatus === 'REJECTED' ? (
            <p className="mt-2 rounded-lg bg-white/60 px-3 py-2">
              <strong>Administrator note:</strong> {provider.rejectionReason}
            </p>
          ) : null}
          <p className="mt-2">
            <Link to="/provider/profile" className="font-semibold underline underline-offset-2">
              Open profile settings
            </Link>
          </p>
        </Alert>
      ) : null}

      {isLoading ? (
        <LoadingBlock label="Loading your provider workspace…" />
      ) : dashboard.isError || !dashboard.data ? (
        <ErrorState
          message="We could not load your provider dashboard. Check your connection and try again."
          onRetry={() => {
            dashboard.refetch();
            self.refetch();
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="New opportunities"
              value={dashboard.data.counts.newOpportunities}
              hint="Open requests matching your services and areas"
              icon={Wrench}
              to="/provider/requests?view=opportunities"
              tone={dashboard.data.counts.newOpportunities > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Pending quotes"
              value={dashboard.data.counts.pendingQuotes}
              hint="Awaiting a customer decision"
              icon={MessageSquareQuote}
              to="/provider/requests?view=quotes"
            />
            <StatCard
              label="Active jobs"
              value={dashboard.data.counts.activeJobs}
              hint="Accepted or in progress"
              icon={ClipboardList}
              to="/provider/requests?view=jobs"
            />
            <StatCard
              label="Completed jobs"
              value={dashboard.data.counts.completedJobs}
              hint="Reviews open after completion"
              icon={CheckCircle2}
              to="/provider/requests?view=jobs&status=COMPLETED"
              tone="success"
            />
            <StatCard
              label="Reviews"
              value={dashboard.data.counts.reviewCount}
              hint="Visible customer reviews"
              icon={Star}
              to="/provider/reviews"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <section aria-labelledby="provider-recent-heading">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 id="provider-recent-heading" className="text-lg font-extrabold">
                      Recent activity
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-mute">
                      New opportunities and requests you have already quoted on or accepted.
                    </p>
                  </div>
                  <Link
                    to="/provider/requests"
                    className={buttonStyles({ variant: 'link', size: 'sm', className: 'shrink-0' })}
                  >
                    View all
                  </Link>
                </div>

                {dashboard.data.recentRequests.length === 0 ? (
                  <EmptyState
                    icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
                    title={
                      approvalStatus === 'APPROVED'
                        ? 'No matching requests right now'
                        : 'Approval is required first'
                    }
                    description={
                      approvalStatus === 'APPROVED'
                        ? 'New open requests appear here when their category and location match an active service and one of your service areas. Widen your areas or add a service if your coverage is limited.'
                        : 'Once an administrator approves your profile, matching open requests will appear here. You can add services and service areas now so matching works as soon as you are approved.'
                    }
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        <Link
                          to="/provider/services"
                          className={buttonStyles({ variant: 'primary', size: 'md' })}
                        >
                          Manage services
                        </Link>
                        <Link
                          to="/provider/profile"
                          className={buttonStyles({ variant: 'secondary', size: 'md' })}
                        >
                          Set service areas
                        </Link>
                      </div>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {dashboard.data.recentRequests.map((request) => (
                      <RequestSummaryCard
                        key={request.id}
                        request={request}
                        perspective="provider"
                        href={`/provider/requests/${request.id}`}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="provider-reviews-heading">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h2 id="provider-reviews-heading" className="text-lg font-extrabold">
                      Latest reviews
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-mute">
                      Only customers with a completed request can leave a review.
                    </p>
                  </div>
                  <Link
                    to="/provider/reviews"
                    className={buttonStyles({ variant: 'link', size: 'sm', className: 'shrink-0' })}
                  >
                    All reviews
                  </Link>
                </div>

                {dashboard.data.recentReviews.length === 0 ? (
                  <div className="card-surface p-5 text-sm text-ink-soft">
                    No visible reviews yet. Reviews appear after a customer marks a completed job
                    and chooses to write one. They cannot be created or edited by providers.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboard.data.recentReviews.map((review) => (
                      <article key={review.id} className="card-surface p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{review.customerDisplayName}</span>
                            <span className="text-xs text-ink-mute">{formatDate(review.createdAt)}</span>
                          </div>
                          <Rating rating={review.rating} count={1} showCount={false} />
                        </div>
                        {review.comment ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
                            {review.comment}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm italic text-ink-mute">No written comment.</p>
                        )}
                        {review.providerResponse ? (
                          <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-xs leading-relaxed text-ink-soft">
                            <span className="font-bold text-ink">Your response: </span>
                            {review.providerResponse}
                          </p>
                        ) : (
                          <Link
                            to="/provider/reviews"
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-800 underline underline-offset-2"
                          >
                            Reply publicly
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <div className="card-surface p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-extrabold">Profile readiness</h2>
                    <p className="mt-0.5 text-xs text-ink-mute">
                      {dashboard.data.profile.completeness}% of the suggested items are complete.
                    </p>
                  </div>
                  <Badge
                    variant={
                      dashboard.data.profile.completeness === 100
                        ? 'brand'
                        : dashboard.data.profile.completeness >= 60
                          ? 'sun'
                          : 'danger'
                    }
                  >
                    {dashboard.data.profile.completeness}%
                  </Badge>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-deep" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-[width]"
                    style={{ width: `${dashboard.data.profile.completeness}%` }}
                  />
                </div>
                {dashboard.data.profile.missing.length === 0 ? (
                  <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-brand-800">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    All suggested profile items are filled in.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1.5 text-xs text-ink-soft">
                    {dashboard.data.profile.missing.map((item) => (
                      <li key={item} className="flex items-start gap-1.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sun-deep" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
                  This checklist is guidance for customers, not a score or a trust rating.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-brand-800">
                  <Link to="/provider/profile" className="underline underline-offset-2">
                    Edit profile
                  </Link>
                  <Link to="/provider/services" className="underline underline-offset-2">
                    Services
                  </Link>
                  <Link to="/provider/verification" className="underline underline-offset-2">
                    Verification
                  </Link>
                </div>
              </div>

              <div className="card-surface p-5">
                <h2 className="flex items-center gap-1.5 text-sm font-extrabold">
                  <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
                  Verification
                </h2>
                <div className="mt-2">
                  {provider ? (
                    <VerificationBadges
                      identityVerified={provider.identityVerified}
                      businessVerified={provider.businessVerified}
                    />
                  ) : (
                    <Badge variant="outline">Status unavailable</Badge>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-mute">
                  A badge means an administrator reviewed a submitted request. It is not a guarantee
                  of work quality. You can submit a request after your provider profile is approved.
                </p>
                <Link
                  to="/provider/verification"
                  className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'mt-3' })}
                >
                  Manage verification
                </Link>
              </div>

              <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
                <p className="flex items-center gap-1.5 font-bold text-ink">
                  <AlertTriangle className="h-3.5 w-3.5 text-sun-deep" aria-hidden="true" />
                  Honest records only
                </p>
                <p className="mt-2">
                  Only start or complete a job when you have actually agreed to the work. Customer
                  contact details unlock after a quote is accepted and must not be used for
                  unrelated marketing. AyosDito does not process payments.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

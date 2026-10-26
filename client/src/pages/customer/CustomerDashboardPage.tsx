import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CalendarCheck2,
  ClipboardList,
  Heart,
  MessageSquareQuote,
  PlusCircle,
  Search,
  Star,
  Wrench,
} from 'lucide-react';
import type { CustomerDashboardDto } from '@shared/api-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/ui/Brand';
import { buttonStyles } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/Feedback';
import { DemoBadge } from '@/components/ui/Verification';
import { StatCard } from '@/components/dashboard/StatCard';
import { RequestSummaryCard } from '@/components/dashboard/RequestSummaryCard';
import { EmailVerificationNotice } from '@/components/dashboard/EmailVerificationNotice';

export function CustomerDashboardPage() {
  useDocumentTitle('Customer dashboard');
  const { user } = useAuth();
  const dashboard = useQuery({
    queryKey: queryKeys.customerDashboard,
    queryFn: () => api.get<CustomerDashboardDto>('/customer/dashboard'),
  });

  const firstName = user?.fullName.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer dashboard"
        title={`Kumusta, ${firstName}?`}
        description="Track the jobs you posted, compare quotations, and keep the details of completed work in one place."
        actions={
          <>
            <Link to="/providers" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
              <Search className="h-4 w-4" aria-hidden="true" />
              Find a provider
            </Link>
            <Link to="/customer/requests/new" className={buttonStyles({ variant: 'primary', size: 'md' })}>
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              New request
            </Link>
          </>
        }
      />

      <EmailVerificationNotice />

      {user?.isDemo ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#f0dcaa] bg-sun-soft/50 px-4 py-3 text-xs text-sun-deep">
          <DemoBadge label="Demo customer" />
          <span>
            This account and its requests are sample data created by the seed script. They are not
            real customers or real job history.
          </span>
        </div>
      ) : null}

      {dashboard.isPending ? (
        <LoadingBlock label="Loading your jobs…" />
      ) : dashboard.isError ? (
        <ErrorState
          message="We could not load your dashboard. Check your connection and try again."
          onRetry={() => dashboard.refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Open requests"
              value={dashboard.data.counts.open}
              hint="Waiting for or comparing quotes"
              icon={ClipboardList}
              to="/customer/requests"
            />
            <StatCard
              label="Quotes to review"
              value={dashboard.data.quotesToReview}
              hint={dashboard.data.quotesToReview > 0 ? 'A provider replied' : 'No new quotes'}
              icon={MessageSquareQuote}
              tone={dashboard.data.quotesToReview > 0 ? 'warning' : 'default'}
              to="/customer/requests?status=RESPONDED"
            />
            <StatCard
              label="Active jobs"
              value={dashboard.data.counts.active}
              hint="Accepted or in progress"
              icon={Wrench}
              to="/customer/requests"
            />
            <StatCard
              label="Completed"
              value={dashboard.data.counts.completed}
              hint="Reviews open after completion"
              icon={CalendarCheck2}
              tone="success"
              to="/customer/requests?status=COMPLETED"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section aria-labelledby="recent-requests-heading">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 id="recent-requests-heading" className="text-lg font-extrabold">
                    Recent requests
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-mute">
                    Updated activity across your repair jobs. Showing up to five.
                  </p>
                </div>
                <Link
                  to="/customer/requests"
                  className={buttonStyles({ variant: 'link', size: 'sm', className: 'shrink-0' })}
                >
                  View all
                </Link>
              </div>

              {dashboard.data.recentRequests.length === 0 ? (
                <EmptyState
                  icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
                  title="No repair requests yet"
                  description="Describe the problem once, choose your area, and compare quotations from approved providers. You can start from a category or search the directory."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Link to="/customer/requests/new" className={buttonStyles({ variant: 'primary', size: 'md' })}>
                        <PlusCircle className="h-4 w-4" aria-hidden="true" />
                        Post a request
                      </Link>
                      <Link to="/services" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
                        Browse services
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
                      perspective="customer"
                      href={`/customer/requests/${request.id}`}
                    />
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <div className="card-surface p-5">
                <h2 className="text-sm font-extrabold">Quick actions</h2>
                <div className="mt-3 space-y-1">
                  <QuickAction to="/customer/requests/new" icon={PlusCircle} label="Post a new request" />
                  <QuickAction to="/providers" icon={Search} label="Browse approved providers" />
                  <QuickAction to="/customer/favorites" icon={Heart} label="View saved providers" />
                  <QuickAction to="/how-it-works" icon={Star} label="How quotes and reviews work" />
                </div>
              </div>

              <div className="card-surface p-5">
                <h2 className="text-sm font-extrabold">Saved providers</h2>
                <p className="mt-2 text-3xl font-extrabold tracking-tight">
                  {dashboard.data.favorites}
                </p>
                <p className="mt-1 text-xs text-ink-mute">
                  Favorites are a shortlist, not a rating or endorsement. Providers still need an
                  approved profile and active service to appear.
                </p>
                <Link
                  to="/customer/favorites"
                  className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'mt-4' })}
                >
                  Open saved providers
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>

              <div className="rounded-2xl border border-line bg-paper-deep/50 p-4 text-xs leading-relaxed text-ink-soft">
                <p className="flex items-center gap-1.5 font-bold text-ink">
                  <Badge variant="outline">No payments</Badge>
                </p>
                <p className="mt-2">
                  AyosDito does not collect payment or hold your money in this MVP. Agree the final
                  scope, schedule, and payment method directly with the provider you choose.
                </p>
                <p className="mt-2 text-ink-mute">
                  Member since {user ? formatDate(user.createdAt) : '—'}.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof PlusCircle;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-soft transition hover:bg-paper-deep hover:text-ink"
    >
      <Icon className="h-4 w-4 text-brand-600" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 text-ink-mute" aria-hidden="true" />
    </Link>
  );
}

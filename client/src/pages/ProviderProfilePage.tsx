import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Flag,
  MapPin,
  MessageSquareQuote,
  ShieldCheck,
  ShieldQuestion,
  Star,
  Wrench,
} from 'lucide-react';
import type { ProviderDetail, ReviewDto } from '@shared/api-types';
import { api, isApiClientError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth, useDocumentTitle } from '@/auth/AuthProvider';
import { categoryIcon } from '@/lib/categoryIcons';
import {
  formatDate,
  formatPeso,
  locationLabel,
  pluralize,
  priceTypeLabel,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { Avatar, IconTile } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { buttonStyles } from '@/components/ui/Button';
import { Rating } from '@/components/ui/Stars';
import { DemoBadge, VerificationBadges } from '@/components/ui/Verification';
import { EmptyState, ErrorState, PageLoader, Skeleton } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { FavoriteButton } from '@/components/providers/FavoriteButton';
import { RequestQuoteDialog } from '@/components/providers/RequestQuoteDialog';
import { ReportDialog } from '@/components/providers/ReportDialog';

const REVIEWS_PAGE_SIZE = 6;

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className={cn(
            'h-3.5 w-3.5',
            value <= rating ? 'fill-sun text-sun' : 'fill-transparent text-line',
          )}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function ProviderProfilePage() {
  const { providerId = '' } = useParams<{ providerId: string }>();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const reviewPage = Math.max(1, Number(params.get('reviewsPage') ?? 1) || 1);
  const [quoteState, setQuoteState] = useState<{ open: boolean; categoryId?: string }>({ open: false });
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewToReport, setReviewToReport] = useState<ReviewDto | null>(null);

  const providerQuery = useQuery({
    queryKey: queryKeys.provider(providerId),
    queryFn: () => api.get<ProviderDetail>(`/providers/${encodeURIComponent(providerId)}`),
    enabled: providerId.length > 0,
    retry: false,
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.providerReviews(providerId, reviewPage),
    queryFn: () =>
      api.list<ReviewDto>(`/providers/${encodeURIComponent(providerId)}/reviews`, {
        page: reviewPage,
        pageSize: REVIEWS_PAGE_SIZE,
      }),
    enabled: providerQuery.isSuccess,
  });

  const provider = providerQuery.data;
  useDocumentTitle(provider ? provider.businessName : 'Provider profile');

  if (providerQuery.isPending) {
    return (
      <div className="page-shell py-10">
        <PageLoader />
      </div>
    );
  }

  if (providerQuery.isError) {
    const notFound = isApiClientError(providerQuery.error) && providerQuery.error.status === 404;
    return (
      <div className="page-shell py-14">
        <ErrorState
          title={notFound ? 'Provider not found' : 'Provider could not be loaded'}
          message={
            notFound
              ? 'This profile may not be approved, may be inactive, or may no longer have an active service and service area.'
              : 'The provider API could not answer. Check your connection and try again.'
          }
          onRetry={notFound ? undefined : () => providerQuery.refetch()}
        >
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/providers" className={buttonStyles({ variant: 'primary', size: 'sm' })}>
              Browse providers
            </Link>
            <Link to="/services" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
              All services
            </Link>
          </div>
        </ErrorState>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="page-shell py-14">
        <ErrorState
          title="Provider unavailable"
          message="The provider request completed without data. Refresh the page or return to the directory."
        >
          <Link to="/providers" className={buttonStyles({ variant: 'primary', size: 'sm', className: 'mt-5' })}>
            Back to providers
          </Link>
        </ErrorState>
      </div>
    );
  }

  const canRequestQuote = provider.listings.length > 0 && provider.serviceAreas.length > 0;
  const canReport = user?.role !== 'PROVIDER' && user?.role !== 'ADMIN';
  const reviews = reviewsQuery.data;

  function changeReviewPage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('reviewsPage');
    else next.set('reviewsPage', String(nextPage));
    setParams(next, { replace: true });
    document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="page-shell py-8 sm:py-12">
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink-mute" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-700">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/providers" className="hover:text-brand-700">
          Providers
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-ink-soft">
          {provider.businessName}
        </span>
      </nav>

      <header className="overflow-hidden rounded-3xl border border-line bg-paper-soft shadow-card">
        <div className="relative h-24 bg-brand-900 sm:h-28" aria-hidden="true">
          <div className="dot-grid absolute inset-0 opacity-20" />
          <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-brand-700/60 blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-paper-soft/20 to-transparent" />
        </div>
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar
                name={provider.businessName}
                imageUrl={provider.profileImage}
                size="xl"
                className="border-4 border-paper-soft shadow-card"
              />
              <div className="min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{provider.businessName}</h1>
                  {provider.isDemo ? <DemoBadge label="Demo provider" /> : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <Rating rating={provider.ratingAvg} count={provider.reviewCount} />
                  <span className="hidden text-line sm:inline" aria-hidden="true">
                    ·
                  </span>
                  <VerificationBadges
                    identityVerified={provider.identityVerified}
                    businessVerified={provider.businessVerified}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-1">
              <FavoriteButton providerId={provider.id} initialFavorite={provider.isFavorite} />
              {canReport ? (
                <button
                  type="button"
                  onClick={() => setReportOpen(true)}
                  className={buttonStyles({ variant: 'ghost', size: 'md' })}
                  title="Report this profile"
                >
                  <Flag className="h-4 w-4" aria-hidden="true" />
                  Report
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setQuoteState({ open: true })}
                disabled={!canRequestQuote}
                className={buttonStyles({ variant: 'primary', size: 'md' })}
                title={canRequestQuote ? undefined : 'This provider has no active service and service area.'}
              >
                <MessageSquareQuote className="h-4 w-4" aria-hidden="true" />
                Request a quote
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-line pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">Service areas</p>
                <p className="mt-0.5 text-xs font-medium text-ink-soft">
                  {provider.serviceAreas.length > 0
                    ? provider.serviceAreas.slice(0, 3).map(locationLabel).join(' · ')
                    : 'No active service area listed'}
                  {provider.serviceAreas.length > 3 ? ` +${provider.serviceAreas.length - 3} more` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">Services</p>
                <p className="mt-0.5 text-xs font-medium text-ink-soft">
                  {provider.listings.length > 0
                    ? `${pluralize(provider.listings.length, 'active listing')} across ${pluralize(
                        new Set(provider.listings.map((listing) => listing.category.id)).size,
                        'category',
                        'categories',
                      )}`
                    : 'No active listing yet'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">Completed jobs</p>
                <p className="mt-0.5 text-xs font-medium text-ink-soft">
                  {pluralize(provider.completedJobs, 'job')} marked complete on AyosDito
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">Member since</p>
                <p className="mt-0.5 text-xs font-medium text-ink-soft">{formatDate(provider.memberSince)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          <section className="card-surface p-5 sm:p-6" aria-label="About this provider">
            <h2 className="text-lg font-bold">About {provider.businessName}</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {provider.description.trim() || 'This provider has not added a description yet.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {provider.categories.map((category) => {
                const Icon = categoryIcon(category.icon);
                return (
                  <Link
                    key={category.id}
                    to={`/services/${category.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                  >
                    <Icon className="h-3 w-3 text-brand-600" aria-hidden="true" />
                    {category.name}
                  </Link>
                );
              })}
            </div>
            {provider.yearsOfExperience ? (
              <p className="mt-4 text-xs leading-relaxed text-ink-mute">
                {pluralize(provider.yearsOfExperience, 'year')} of experience, self-reported by the
                provider. AyosDito does not independently verify this claim.
              </p>
            ) : null}
          </section>

          <section className="card-surface p-5 sm:p-6" aria-labelledby="provider-services">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="provider-services" className="text-lg font-bold">
                  Services &amp; price guides
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ink-mute">
                  Prices are provider-supplied estimates. A final quotation may follow inspection.
                </p>
              </div>
              <Badge variant="outline">{pluralize(provider.listings.length, 'listing')}</Badge>
            </div>

            {provider.listings.length === 0 ? (
              <EmptyState
                className="mt-5"
                icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
                title="No active services right now"
                description="This provider has no published active service, so quote requests are closed for now."
              />
            ) : (
              <ul className="mt-5 space-y-3">
                {provider.listings.map((listing) => {
                  const Icon = categoryIcon(listing.category.icon);
                  return (
                    <li key={listing.id} className="rounded-xl border border-line bg-paper p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3.5">
                          <IconTile icon={Icon} size="sm" className="mt-0.5 shrink-0" />
                          <div>
                            <h3 className="text-sm font-bold text-ink">{listing.title}</h3>
                            <p className="mt-0.5 text-[11px] font-semibold text-ink-mute">
                              {listing.category.name}
                            </p>
                            {listing.description ? (
                              <p className="mt-2 text-xs leading-relaxed text-ink-soft">{listing.description}</p>
                            ) : null}
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {listing.requiresInspection ? (
                                <Badge variant="sun">Inspection required</Badge>
                              ) : null}
                              {listing.diagnosticFee !== null ? (
                                <Badge variant="outline">
                                  Diagnostic fee {formatPeso(listing.diagnosticFee)}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 sm:text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">
                            {priceTypeLabel(listing.priceType)}
                          </p>
                          <p className="mt-0.5 font-display text-xl font-extrabold text-ink">
                            {formatPeso(listing.startingPrice)}
                          </p>
                          <button
                            type="button"
                            onClick={() => setQuoteState({ open: true, categoryId: listing.category.id })}
                            className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'mt-2' })}
                          >
                            Request this service
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {provider.portfolioImages.length > 0 ? (
            <section className="card-surface p-5 sm:p-6" aria-labelledby="provider-portfolio">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="provider-portfolio" className="text-lg font-bold">
                  Portfolio
                </h2>
                <Badge variant="outline">{pluralize(provider.portfolioImages.length, 'photo')}</Badge>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-mute">
                Photos are supplied by the provider. They illustrate past work but are not independently
                verified service records.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {provider.portfolioImages.map((image) => (
                  <figure key={image.id} className="overflow-hidden rounded-xl border border-line bg-paper">
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={image.imageUrl}
                        alt={image.caption ?? `Portfolio work by ${provider.businessName}`}
                        className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    {image.caption ? (
                      <figcaption className="px-3 py-2 text-[11px] leading-relaxed text-ink-soft">
                        {image.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <section id="reviews" className="card-surface scroll-mt-24 p-5 sm:p-6" aria-labelledby="provider-reviews">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="provider-reviews" className="text-lg font-bold">
                  Reviews
                </h2>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-mute">
                  Only customers with a completed job can review. Each request allows one review, and
                  providers cannot review themselves.
                </p>
              </div>
              <Rating rating={provider.ratingAvg} count={provider.reviewCount} size="md" />
            </div>

            {provider.reviewCount === 0 ? (
              <EmptyState
                className="mt-5"
                icon={<Star className="h-5 w-5" aria-hidden="true" />}
                title="No reviews yet"
                description="This profile has not received a visible review from a completed job. No rating is shown as if it were earned."
              />
            ) : reviewsQuery.isPending ? (
              <div className="mt-5 space-y-4" aria-busy="true">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-2 border-t border-line pt-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))}
              </div>
            ) : reviewsQuery.isError ? (
              <div className="mt-5">
                <ErrorState
                  title="Reviews could not be loaded"
                  message="The review list did not respond. The rating summary above still reflects stored reviews."
                  onRetry={() => reviewsQuery.refetch()}
                />
              </div>
            ) : reviews && reviews.data.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-mute">
                No reviews on this page.
              </p>
            ) : reviews ? (
              <>
                <div className="mt-4 divide-y divide-line">
                  {reviews.data.map((review) => (
                    <article key={review.id} className="py-5 first:pt-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar name={review.customerDisplayName} size="sm" />
                          <div>
                            <p className="text-sm font-bold text-ink">{review.customerDisplayName}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <ReviewStars rating={review.rating} />
                              <span className="text-[11px] text-ink-mute">{formatDate(review.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        {canReport ? (
                          <button
                            type="button"
                            onClick={() => setReviewToReport(review)}
                            className="inline-flex items-center gap-1 rounded text-[11px] font-semibold text-ink-mute hover:text-clay"
                          >
                            <Flag className="h-3 w-3" aria-hidden="true" />
                            Report
                          </button>
                        ) : null}
                      </div>
                      {review.comment ? (
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                          {review.comment}
                        </p>
                      ) : null}
                      {review.providerResponse ? (
                        <div className="mt-3 rounded-xl border border-line bg-paper px-3.5 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-brand-700">
                            Provider response
                          </p>
                          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                            {review.providerResponse}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
                {reviews.meta.totalPages > 1 ? (
                  <Pagination
                    className="mt-2"
                    page={reviews.meta.page}
                    pageSize={reviews.meta.pageSize}
                    total={reviews.meta.total}
                    totalPages={reviews.meta.totalPages}
                    onPageChange={changeReviewPage}
                  />
                ) : null}
              </>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card-surface overflow-hidden">
            <div className="ticket-top h-1.5" aria-hidden="true" />
            <div className="p-5">
              <h2 className="text-base font-bold">Request a quotation</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                Describe the problem once. This provider can reply with a price and estimated duration.
              </p>
              <button
                type="button"
                onClick={() => setQuoteState({ open: true })}
                disabled={!canRequestQuote}
                className={buttonStyles({ variant: 'primary', size: 'md', fullWidth: true, className: 'mt-4' })}
              >
                <MessageSquareQuote className="h-4 w-4" aria-hidden="true" />
                {canRequestQuote ? 'Start a request' : 'Requests closed'}
              </button>
              {!canRequestQuote ? (
                <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
                  Quote requests need at least one active listing and service area.
                </p>
              ) : null}
              <ul className="mt-4 space-y-2.5 text-xs text-ink-soft">
                <li className="flex gap-2">
                  <ClipboardCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
                  Your contact details are hidden from providers until you accept a quote.
                </li>
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
                  You can decline quotes or cancel while the request is still open.
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden="true" />
                  No online payment is collected in this MVP.
                </li>
              </ul>
            </div>
          </div>

          <div className="card-surface p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
              <h2 className="text-sm font-bold">Verification status</h2>
            </div>
            <div className="mt-2.5">
              <VerificationBadges
                identityVerified={provider.identityVerified}
                businessVerified={provider.businessVerified}
              />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              {provider.businessVerified
                ? 'An administrator approved a business verification request for this provider. Details reviewed are not public.'
                : provider.identityVerified
                  ? 'An administrator approved an identity verification request for this provider. Submitted evidence is not public.'
                  : 'No identity or business verification has been approved yet. An account alone is not a verification.'}
            </p>
            <Link
              to="/how-it-works#trust"
              className="mt-3 inline-block text-[11px] font-semibold text-brand-700 underline-offset-2 hover:underline"
            >
              What badges mean
            </Link>
          </div>

          <div className="card-surface p-5">
            <h2 className="text-sm font-bold">Service areas</h2>
            {provider.serviceAreas.length === 0 ? (
              <p className="mt-2 text-xs text-ink-mute">No active service area listed.</p>
            ) : (
              <ul className="mt-2.5 space-y-1.5">
                {provider.serviceAreas.map((area) => (
                  <li key={area.id} className="flex items-start gap-2 text-xs text-ink-soft">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                    {locationLabel(area)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-sun/40 bg-sun-soft/60 p-4">
            <p className="flex gap-2 text-xs leading-relaxed text-sun-deep">
              <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Listings, photos, and prices come from the provider. AyosDito does not verify every
                claim, review the work, or process payment.
              </span>
            </p>
          </div>

          {provider.isDemo ? (
            <div className="rounded-xl border border-line bg-paper-soft p-4">
              <DemoBadge label="Demo provider" />
              <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
                This profile, its listings, and related reviews were created by the development seed
                script for testing. It does not represent a real business.
              </p>
            </div>
          ) : null}
        </aside>
      </div>

      <RequestQuoteDialog
        provider={provider}
        open={quoteState.open}
        initialCategoryId={quoteState.categoryId}
        onOpenChange={(open) => setQuoteState((previous) => ({ ...previous, open }))}
      />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        entityType="PROVIDER"
        entityId={provider.id}
        entityLabel={provider.businessName}
      />
      {reviewToReport ? (
        <ReportDialog
          open
          onOpenChange={(open) => {
            if (!open) setReviewToReport(null);
          }}
          entityType="REVIEW"
          entityId={reviewToReport.id}
          entityLabel="this review"
        />
      ) : null}
    </div>
  );
}

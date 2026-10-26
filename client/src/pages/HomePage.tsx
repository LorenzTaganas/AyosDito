import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  LockKeyhole,
  MapPin,
  MessageSquareText,
  Search,
  ShieldCheck,
  ShieldQuestion,
  Star,
  Wrench,
} from 'lucide-react';
import type { ProviderSummary } from '@shared/api-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useCategories, useLocations } from '@/hooks/catalog';
import { buildLocationOptions, groupLocationOptions } from '@/lib/locations';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { buttonStyles } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { IconTile } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { DemoBadge } from '@/components/ui/Verification';
import { EmptyState, ProviderCardSkeleton, Skeleton } from '@/components/ui/Feedback';
import { SectionHeading } from '@/components/ui/Brand';
import { CategoryCard, ProviderCard } from '@/components/providers/ProviderCard';

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Describe the job',
    description: 'Share what needs fixing, choose a category and your location, and request quotes.',
  },
  {
    icon: MessageSquareText,
    title: 'Compare quotations',
    description: 'Review each provider’s price, notes, and estimated duration side by side.',
  },
  {
    icon: CheckCircle2,
    title: 'Choose and track',
    description: 'Accept one quote, follow the job from accepted to completed, then leave a review.',
  },
];

const COMMITMENTS = [
  {
    icon: Star,
    title: 'Reviews after completion only',
    description: 'The review form unlocks only when the assigned provider marks the job completed.',
  },
  {
    icon: ShieldCheck,
    title: 'Badges follow a real check',
    description: '“ID checked” and “Business verified” appear only after an administrator reviews a request.',
  },
  {
    icon: FileCheck2,
    title: 'One review per job',
    description: 'Each completed request can produce one review. Providers cannot review themselves.',
  },
  {
    icon: ShieldQuestion,
    title: 'Reports go to a human',
    description: 'Reported profiles and reviews enter a moderation queue for an administrator to review.',
  },
];

export function HomePage() {
  useDocumentTitle(null);
  const navigate = useNavigate();
  const categories = useCategories();
  const locations = useLocations();
  const [categorySlug, setCategorySlug] = useState('');
  const [locationId, setLocationId] = useState('');
  const [keyword, setKeyword] = useState('');

  const featuredQuery = useQuery({
    queryKey: queryKeys.providerSearch({ surface: 'home', pageSize: 3 }),
    queryFn: () => api.list<ProviderSummary>('/providers', { pageSize: 3, sort: 'recommended' }),
    staleTime: 60_000,
  });

  const locationGroups = useMemo(
    () => groupLocationOptions(buildLocationOptions(locations.data ?? [])),
    [locations.data],
  );

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (categorySlug) params.set('category', categorySlug);
    if (locationId) params.set('locationId', locationId);
    const serialized = params.toString();
    navigate(serialized ? `/providers?${serialized}` : '/providers');
  }

  const featured = featuredQuery.data;
  const categoriesData = categories.data ?? [];

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-sun-soft/70 blur-3xl" />
          <div className="absolute -left-40 top-40 h-[24rem] w-[24rem] rounded-full bg-brand-100/60 blur-3xl" />
          <div className="dot-grid absolute inset-y-0 right-0 w-1/3 opacity-40 [mask-image:linear-gradient(to_left,black,transparent)]" />
        </div>

        <div className="page-shell relative grid gap-12 py-12 sm:py-16 lg:grid-cols-[1.03fr_0.97fr] lg:items-center lg:gap-16 lg:py-20">
          <div className="animate-fade-up">
            <Badge variant="brand" size="md" className="gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-hidden="true" />
              Local service marketplace · Philippines
            </Badge>
            <h1 className="mt-5 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              May sira?
              <br />
              May <span className="text-brand-700">maaasahang</span> aayos
              <span className="text-sun">!</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft sm:text-base">
              Post what needs fixing, compare clear quotations from local repair professionals, and
              follow the job until it is done. Built for laptops, phones, appliances, electrical work,
              plumbing, aircon, and everyday home repairs.
            </p>

            <form
              onSubmit={handleSearch}
              className="mt-7 rounded-2xl border border-line bg-paper-soft p-3 shadow-card sm:p-4"
              aria-label="Search for a local provider"
            >
              <div className="grid gap-3 sm:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <label
                    htmlFor="home-keyword"
                    className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-mute"
                  >
                    What needs fixing?
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
                      aria-hidden="true"
                    />
                    <Input
                      id="home-keyword"
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      placeholder="Leaking faucet, slow laptop…"
                      maxLength={100}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="home-location"
                    className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-mute"
                  >
                    Where?
                  </label>
                  <div className="relative">
                    <MapPin
                      className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-ink-mute"
                      aria-hidden="true"
                    />
                    <Select
                      id="home-location"
                      value={locationId}
                      onChange={(event) => setLocationId(event.target.value)}
                      className="pl-10"
                    >
                      <option value="">All supported locations</option>
                      {locationGroups.map(([group, options]) => (
                        <optgroup key={group} label={group}>
                          {options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Select
                  aria-label="Service category"
                  value={categorySlug}
                  onChange={(event) => setCategorySlug(event.target.value)}
                  className="sm:max-w-[14rem]"
                >
                  <option value="">All service categories</option>
                  {categoriesData.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                <button type="submit" className={buttonStyles({ variant: 'primary', size: 'md', className: 'sm:ml-auto sm:px-6' })}>
                  <Search className="h-4 w-4" aria-hidden="true" />
                  Find providers
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">
                Free to search and request quotes. No payment details are collected in this MVP.
              </p>
            </form>

            <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-mute">
              <span className="font-semibold text-ink-soft">Popular:</span>
              {categories.isPending
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-6 w-24 rounded-full" />
                  ))
                : categoriesData.slice(0, 4).map((category) => (
                    <Link
                      key={category.id}
                      to={`/providers?category=${encodeURIComponent(category.slug)}`}
                      className="inline-flex items-center rounded-full border border-line bg-paper-soft px-2.5 py-1 font-medium text-ink-soft transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
                    >
                      {category.name}
                    </Link>
                  ))}
              <Link to="/services" className="font-semibold text-brand-700 hover:underline">
                View all services
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="absolute -right-3 -top-5 hidden rotate-3 rounded-xl border border-line bg-paper-soft px-3.5 py-2.5 shadow-card sm:block">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                <LockKeyhole className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
                Contact details stay private
              </p>
              <p className="mt-0.5 text-[10px] text-ink-mute">Shared only with the accepted provider.</p>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-line bg-paper-soft shadow-ticket">
              <div className="ticket-top h-2" aria-hidden="true" />
              <div className="p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow">Your job slip</p>
                    <h2 className="mt-1.5 text-xl font-extrabold sm:text-2xl">
                      From “may sira” to “ayos.”
                    </h2>
                  </div>
                  <IconTile icon={Wrench} />
                </div>

                <ol className="mt-7 space-y-5">
                  {STEPS.map((step, index) => (
                    <li key={step.title} className="relative flex gap-4">
                      {index < STEPS.length - 1 ? (
                        <span
                          className="absolute left-[1.1rem] top-10 h-[calc(100%+0.3rem)] w-px bg-line"
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-brand-100 bg-brand-50 text-brand-800">
                        <step.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-sm font-bold text-ink">{step.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{step.description}</p>
                      </div>
                      <span className="ml-auto hidden self-start pt-1 text-[10px] font-bold tabular-nums text-ink-mute sm:block">
                        0{index + 1}
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="mt-7 rounded-xl border border-dashed border-brand-200 bg-brand-50/70 p-4">
                  <p className="flex gap-2.5 text-xs leading-relaxed text-brand-900">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      <strong className="font-bold">Your request is not a public post.</strong> It is
                      matched to relevant approved providers. Your email is only shared with the
                      provider whose quote you accept.
                    </span>
                  </p>
                </div>
                <p className="mt-4 text-[10px] leading-relaxed text-ink-mute">
                  Illustration of the AyosDito request flow · No online payments or escrow
                </p>
              </div>
            </div>

            <div className="absolute -bottom-6 left-4 hidden items-center gap-2 rounded-xl border border-line bg-paper-soft px-3.5 py-2.5 shadow-card sm:flex">
              <BadgeCheck className="h-4 w-4 text-sun-deep" aria-hidden="true" />
              <span className="text-[11px] font-semibold text-ink-soft">
                Verification is shown only after review
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-paper-soft">
        <div className="page-shell py-14 sm:py-16">
          <SectionHeading
            eyebrow="Browse by service"
            title="What needs fixing today?"
            description="Every category below is active in the AyosDito catalog. Provider counts come from live, approved profiles with at least one active service."
            linkTo="/services"
            linkLabel="See all services →"
          />

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {categories.isPending ? (
              Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-[5.75rem] rounded-2xl" />
              ))
            ) : categories.isError ? (
              <div className="sm:col-span-2 lg:col-span-4">
                <EmptyState
                  title="Categories could not be loaded"
                  description="The catalog API did not respond. Check your connection, then refresh this page."
                  action={
                    <button type="button" onClick={() => categories.refetch()} className={buttonStyles({ variant: 'secondary' })}>
                      Try again
                    </button>
                  }
                />
              </div>
            ) : (
              categoriesData.map((category) => <CategoryCard key={category.id} category={category} />)
            )}
          </div>
        </div>
      </section>

      <section className="page-shell py-14 sm:py-16">
        <SectionHeading
          eyebrow="How it works"
          title="One request. Clear quotes. No guesswork."
          description="AyosDito keeps the request, quotation, and job status in one thread so both sides know what happens next."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="card-surface relative p-6">
              <span className="font-display text-4xl font-extrabold text-brand-100" aria-hidden="true">
                0{index + 1}
              </span>
              <IconTile icon={step.icon} className="mt-4" />
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link to="/how-it-works" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
            Read the full process
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="text-xs text-ink-mute">
            Covers quotes, statuses, reviews, and what happens when something goes wrong.
          </span>
        </div>
      </section>

      <section className="border-y border-line bg-paper-soft">
        <div className="page-shell py-14 sm:py-16">
          <SectionHeading
            eyebrow="Listed providers"
            title="Real profiles from the live database"
            description="These profiles are returned by the provider API right now. Sample records created by the demo seed are labeled as demo records."
            linkTo="/providers"
            linkLabel="Browse the directory →"
          />

          {featuredQuery.isPending ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <ProviderCardSkeleton key={index} />
              ))}
            </div>
          ) : featuredQuery.isError ? (
            <p className="mt-6 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink-soft">
              We could not load provider profiles just now.{' '}
              <button type="button" onClick={() => featuredQuery.refetch()} className="font-semibold text-brand-700 underline">
                Try again
              </button>
            </p>
          ) : featured && featured.data.length > 0 ? (
            <>
              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {featured.data.map((provider) => (
                  <ProviderCard key={provider.id} provider={provider} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-ink-mute">
                  {featured.meta.total} approved {featured.meta.total === 1 ? 'provider is' : 'providers are'} currently
                  listed with an active service.
                </p>
                {featured.meta.includesDemoData ? (
                  <p className="flex items-center gap-1.5 text-xs text-ink-mute">
                    <DemoBadge label="Demo record" /> marks fictional seed data.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState
              className="mt-8"
              title="No approved providers are listed yet"
              description="When an administrator approves a provider with an active service, the profile will appear here automatically."
              action={
                <Link to="/become-a-provider" className={buttonStyles({ variant: 'primary' })}>
                  Become a provider
                </Link>
              }
            />
          )}
        </div>
      </section>

      <section className="page-shell py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="eyebrow">Trust, explained plainly</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
              A badge is evidence of a check. It is not a promise of perfect work.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Anyone can create an account. AyosDito separates registration, administrator approval,
              and optional identity or business verification so each signal means something specific.
            </p>
            <Link to="/how-it-works#trust" className={buttonStyles({ variant: 'link', size: 'sm', className: 'mt-4' })}>
              Read what each badge means →
            </Link>
            <div className="mt-7 space-y-3">
              {COMMITMENTS.map((item) => (
                <div key={item.title} className="flex gap-3 rounded-xl border border-line bg-paper-soft p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-mute">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="card-surface flex flex-col p-5">
              <Badge variant="outline">Not yet verified</Badge>
              <ShieldQuestion className="mt-4 h-6 w-6 text-ink-mute" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-bold">Registered only</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                The provider has an approved profile, but no identity or business check has been
                completed. This says nothing about their work quality.
              </p>
            </div>
            <div className="card-surface flex flex-col p-5">
              <Badge variant="sky">ID checked</Badge>
              <ShieldCheck className="mt-4 h-6 w-6 text-sky-deep" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-bold">Identity reviewed</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                An administrator reviewed a submitted identity verification request. The evidence
                itself is never shown publicly.
              </p>
            </div>
            <div className="card-surface flex flex-col border-brand-200 bg-brand-50/60 p-5">
              <Badge variant="brand">Business verified</Badge>
              <BadgeCheck className="mt-4 h-6 w-6 text-brand-700" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-bold">Business reviewed</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                An administrator reviewed business details supplied by the provider. It does not
                guarantee every future job or price.
              </p>
            </div>
            <div className="sm:col-span-3">
              <div className="flex items-start gap-3 rounded-xl border border-sun/40 bg-sun-soft/60 p-4">
                <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-sun-deep" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-sun-deep">
                  <strong className="font-bold">Please do not treat any profile as risk-free.</strong>{' '}
                  Compare quotes, ask about parts and warranty, and avoid transferring large down
                  payments before work begins. AyosDito does not process payments or guarantee workmanship
                  in this MVP.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell pb-16 pt-2 sm:pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-900 px-6 py-10 text-paper-soft shadow-ticket sm:px-10 lg:px-14 lg:py-14">
          <div className="dot-grid absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand-700/60 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sun">For local providers</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl">
                Put your repair skills where customers are looking.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-brand-100/80">
                Publish your services and service areas, receive structured quote requests, and manage
                jobs from one dashboard. Provider profiles are visible only after administrator
                approval. AyosDito does not sell rankings or guarantee bookings.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <Link to="/register?role=provider" className={buttonStyles({ variant: 'sun', size: 'lg', className: 'shrink-0' })}>
                Create a provider account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                to="/become-a-provider"
                className={buttonStyles({
                  variant: 'ghost',
                  size: 'lg',
                  className:
                    'shrink-0 border border-brand-700 text-brand-100 hover:bg-brand-800 hover:text-white',
                })}
              >
                See how approval works
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

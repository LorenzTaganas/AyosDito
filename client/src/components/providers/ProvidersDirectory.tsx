import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import type { ProviderSummary } from '@shared/api-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useCategories, useLocations } from '@/hooks/catalog';
import { buildLocationOptions, groupLocationOptions } from '@/lib/locations';
import { formatPesosInput, pesosToCentavos } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState, ProviderCardSkeleton } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { Alert } from '@/components/ui/Alert';
import { ProviderCard } from './ProviderCard';

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'rating', label: 'Highest rated (3+ reviews)' },
  { value: 'price_asc', label: 'Lowest starting price' },
  { value: 'price_desc', label: 'Highest starting price' },
  { value: 'newest', label: 'Newest providers' },
];

interface ProvidersDirectoryProps {
  lockedCategorySlug?: string;
  title?: string;
  description?: string;
  hideHeading?: boolean;
}

export function ProvidersDirectory({ lockedCategorySlug, title, description, hideHeading }: ProvidersDirectoryProps) {
  const [params, setParams] = useSearchParams();
  const categories = useCategories();
  const locations = useLocations();

  const q = params.get('q') ?? '';
  const categorySlug = lockedCategorySlug ?? params.get('category') ?? '';
  const locationId = params.get('locationId') ?? '';
  const minRating = params.get('minRating') ?? '';
  const verified = params.get('verified') ?? '';
  const sort = params.get('sort') ?? 'recommended';
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const minPriceRaw = params.get('minPrice');
  const maxPriceRaw = params.get('maxPrice');

  const [keyword, setKeyword] = useState(q);
  const [minPrice, setMinPrice] = useState(formatPesosInput(minPriceRaw ? Number(minPriceRaw) : null));
  const [maxPrice, setMaxPrice] = useState(formatPesosInput(maxPriceRaw ? Number(maxPriceRaw) : null));
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => setKeyword(q), [q]);
  useEffect(() => setMinPrice(formatPesosInput(minPriceRaw ? Number(minPriceRaw) : null)), [minPriceRaw]);
  useEffect(() => setMaxPrice(formatPesosInput(maxPriceRaw ? Number(maxPriceRaw) : null)), [maxPriceRaw]);

  const locationGroups = useMemo(
    () => groupLocationOptions(buildLocationOptions(locations.data ?? [])),
    [locations.data],
  );

  const queryParams = useMemo(
    () => ({
      q: q || undefined,
      category: categorySlug || undefined,
      locationId: locationId || undefined,
      minPrice: minPriceRaw ? Number(minPriceRaw) : undefined,
      maxPrice: maxPriceRaw ? Number(maxPriceRaw) : undefined,
      minRating: minRating || undefined,
      verified: verified || undefined,
      sort,
      page,
      pageSize: 12,
    }),
    [q, categorySlug, locationId, minPriceRaw, maxPriceRaw, minRating, verified, sort, page],
  );

  const providersQuery = useQuery({
    queryKey: queryKeys.providerSearch(queryParams),
    queryFn: () => api.list<ProviderSummary>('/providers', queryParams),
  });

  const advancedActiveCount = [minPriceRaw, maxPriceRaw, minRating, verified].filter(Boolean).length;
  const hasFilters =
    Boolean(q || categorySlug || locationId || minPriceRaw || maxPriceRaw || minRating || verified) ||
    (sort !== 'recommended' && Boolean(sort));

  function updateParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
    }
    setParams(next, { replace: true });
  }

  function handleKeywordSubmit(event: FormEvent) {
    event.preventDefault();
    updateParams({ q: keyword.trim() || null });
  }

  function applyPrices(event: FormEvent) {
    event.preventDefault();
    const min = minPrice.trim() === '' ? null : pesosToCentavos(minPrice);
    const max = maxPrice.trim() === '' ? null : pesosToCentavos(maxPrice);
    if (min !== null && max !== null && min > max) {
      setPriceError('Maximum price must be higher than the minimum.');
      return;
    }
    setPriceError(null);
    updateParams({
      minPrice: min !== null && min >= 0 ? String(min) : null,
      maxPrice: max !== null && max >= 0 ? String(max) : null,
    });
  }

  function clearAll() {
    setParams(new URLSearchParams(), { replace: true });
  }

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (q) activeChips.push({ key: 'q', label: `“${q}”`, clear: () => updateParams({ q: null }) });
  if (!lockedCategorySlug && categorySlug) {
    const category = categories.data?.find((row) => row.slug === categorySlug);
    activeChips.push({
      key: 'category',
      label: category?.name ?? categorySlug,
      clear: () => updateParams({ category: null }),
    });
  }
  if (locationId) {
    const location = locations.data?.find((row) => row.id === locationId);
    activeChips.push({
      key: 'locationId',
      label: location ? (location.parentName ? `${location.name}, ${location.parentName}` : location.name) : 'Location',
      clear: () => updateParams({ locationId: null }),
    });
  }
  if (minPriceRaw) {
    activeChips.push({
      key: 'minPrice',
      label: `Min ₱${Number(minPriceRaw) / 100}`,
      clear: () => updateParams({ minPrice: null }),
    });
  }
  if (maxPriceRaw) {
    activeChips.push({
      key: 'maxPrice',
      label: `Max ₱${Number(maxPriceRaw) / 100}`,
      clear: () => updateParams({ maxPrice: null }),
    });
  }
  if (minRating) {
    activeChips.push({ key: 'minRating', label: `${minRating}★ & up`, clear: () => updateParams({ minRating: null }) });
  }
  if (verified) {
    activeChips.push({
      key: 'verified',
      label: verified === 'business' ? 'Business verified' : 'ID checked',
      clear: () => updateParams({ verified: null }),
    });
  }

  const heading = title ?? (lockedCategorySlug ? 'Local providers' : 'Find a local provider');
  const subheading =
    description ??
    'Every result below comes from the live database. Ratings only appear when a provider has at least one visible review.';

  return (
    <div>
      {hideHeading ? null : (
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight">{heading}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{subheading}</p>
          </div>
          {providersQuery.data ? (
            <p className="shrink-0 text-sm font-semibold text-ink-soft">
              {providersQuery.data.meta.total} {providersQuery.data.meta.total === 1 ? 'provider' : 'providers'}
            </p>
          ) : null}
        </div>
      )}

      <div className="card-surface p-4 sm:p-5">
        <form onSubmit={handleKeywordSubmit} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
              aria-hidden="true"
            />
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Try “laptop”, “leak”, or “aircon”"
              aria-label="Search providers by keyword"
              className="pl-10"
              maxLength={100}
            />
          </div>
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {!lockedCategorySlug ? (
            <Field id="filter-category" label="Service">
              <Select
                id="filter-category"
                value={categorySlug}
                onChange={(event) => updateParams({ category: event.target.value || null })}
              >
                <option value="">All service categories</option>
                {(categories.data ?? []).map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name} ({category.providerCount})
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field id="filter-location" label="Location">
            <Select
              id="filter-location"
              value={locationId}
              onChange={(event) => updateParams({ locationId: event.target.value || null })}
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
          </Field>
          <Field id="filter-sort" label="Sort by">
            <Select
              id="filter-sort"
              value={sort}
              onChange={(event) => updateParams({ sort: event.target.value === 'recommended' ? null : event.target.value })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="filter-rating" label="Rating">
            <Select
              id="filter-rating"
              value={minRating}
              onChange={(event) => updateParams({ minRating: event.target.value || null })}
            >
              <option value="">Any rating</option>
              <option value="3">3★ &amp; up (3+ reviews)</option>
              <option value="4">4★ &amp; up (3+ reviews)</option>
              <option value="5">5★ (3+ reviews)</option>
            </Select>
          </Field>
        </div>

        <details className="mt-4 rounded-xl border border-line bg-paper/60 px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink-soft">
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-brand-700" aria-hidden="true" />
              Price &amp; verification filters
            </span>
            <span className="text-xs font-medium text-ink-mute">
              {advancedActiveCount > 0 ? `${advancedActiveCount} active` : 'Optional'}
            </span>
          </summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="filter-min-price" label="Minimum price (₱)">
              <Input
                id="filter-min-price"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="e.g. 300"
                aria-invalid={Boolean(priceError)}
              />
            </Field>
            <Field id="filter-max-price" label="Maximum price (₱)" error={priceError}>
              <Input
                id="filter-max-price"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="e.g. 5000"
                aria-invalid={Boolean(priceError)}
              />
            </Field>
            <Field id="filter-verified" label="Verification">
              <Select
                id="filter-verified"
                value={verified}
                onChange={(event) => updateParams({ verified: event.target.value || null })}
              >
                <option value="">Any verification state</option>
                <option value="identity">ID checked</option>
                <option value="business">Business verified</option>
              </Select>
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="secondary" onClick={applyPrices} fullWidth>
                Apply price range
              </Button>
            </div>
          </div>
          <p className="field-help">Prices are provider-supplied estimates, not guaranteed final charges.</p>
        </details>

        {hasFilters ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="text-xs font-semibold text-ink-mute">Active:</span>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100"
              >
                {chip.label}
                <X className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto text-xs font-semibold text-ink-mute underline underline-offset-2 hover:text-ink"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {providersQuery.data?.meta.includesDemoData ? (
        <Alert tone="warning" className="mt-4">
          Some results are labeled <strong>Demo record</strong>. They are sample seed data, not real
          businesses, and should not be presented as genuine customer proof.
        </Alert>
      ) : null}

      <div className="mt-6">
        {providersQuery.isPending ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading providers">
            {Array.from({ length: 6 }).map((_, index) => (
              <ProviderCardSkeleton key={index} />
            ))}
          </div>
        ) : providersQuery.isError ? (
          <ErrorState
            message="We could not load providers right now. Check your connection and try again."
            onRetry={() => providersQuery.refetch()}
          />
        ) : providersQuery.data.data.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-5 w-5" aria-hidden="true" />}
            title="No providers match these filters"
            description="Try removing a filter, choosing a nearby city, or searching with a simpler keyword. The marketplace only shows approved providers with active services."
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clearAll}>
                  Clear all filters
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => providersQuery.refetch()}>
                  Refresh results
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-3')}>
              {providersQuery.data.data.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </div>
            <Pagination
              className="mt-8"
              page={providersQuery.data.meta.page}
              pageSize={providersQuery.data.meta.pageSize}
              total={providersQuery.data.meta.total}
              totalPages={providersQuery.data.meta.totalPages}
              onPageChange={(nextPage) => {
                updateParams({ page: String(nextPage) });
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

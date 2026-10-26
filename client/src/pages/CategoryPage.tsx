import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Wrench } from 'lucide-react';
import type { CategoryDto } from '@shared/api-types';
import { api, isApiClientError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useCategories } from '@/hooks/catalog';
import { categoryIcon } from '@/lib/categoryIcons';
import { pluralize } from '@/lib/format';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { ProvidersDirectory } from '@/components/providers/ProvidersDirectory';
import { IconTile } from '@/components/ui/Avatar';
import { buttonStyles } from '@/components/ui/Button';
import { ErrorState, PageLoader } from '@/components/ui/Feedback';

export function CategoryPage() {
  const { categorySlug = '' } = useParams<{ categorySlug: string }>();
  const categoryQuery = useQuery({
    queryKey: queryKeys.category(categorySlug),
    queryFn: () => api.get<CategoryDto>(`/categories/${encodeURIComponent(categorySlug)}`),
    enabled: categorySlug.length > 0,
    retry: false,
  });
  const categories = useCategories();
  const category = categoryQuery.data;
  useDocumentTitle(category ? category.name : 'Service category');
  const Icon = categoryIcon(category?.icon);

  if (categoryQuery.isPending) {
    return <PageLoader />;
  }

  if (categoryQuery.isError) {
    const notFound = isApiClientError(categoryQuery.error) && categoryQuery.error.status === 404;
    return (
      <div className="page-shell py-14">
        <ErrorState
          title={notFound ? 'Service category not found' : 'Category could not be loaded'}
          message={
            notFound
              ? 'This category may be inactive or its address may have changed. Browse the full service catalog to find the right category.'
              : 'The catalog API could not answer. Check your connection and try again.'
          }
          onRetry={notFound ? undefined : () => categoryQuery.refetch()}
        >
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link to="/services" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              All services
            </Link>
            <Link to="/providers" className={buttonStyles({ variant: 'primary', size: 'sm' })}>
              Browse providers
            </Link>
          </div>
        </ErrorState>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="page-shell py-14">
        <ErrorState
          title="Category unavailable"
          message="The category request completed without data. Refresh the page or go back to the service catalog."
        >
          <Link to="/services" className={buttonStyles({ variant: 'primary', size: 'sm', className: 'mt-5' })}>
            Back to services
          </Link>
        </ErrorState>
      </div>
    );
  }

  const otherCategories = (categories.data ?? []).filter((row) => row.slug !== category.slug).slice(0, 6);

  return (
    <div className="page-shell py-10 sm:py-14">
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink-mute" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-700">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/services" className="hover:text-brand-700">
          Services
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="text-ink-soft">
          {category.name}
        </span>
      </nav>

      <div className="grid gap-6 rounded-3xl border border-line bg-paper-soft p-6 shadow-card sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <IconTile icon={Icon} size="lg" className="shrink-0" />
          <div>
            <p className="eyebrow">Service category</p>
            <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight sm:text-4xl">{category.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              {category.description ?? 'Find approved local providers offering this service.'}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-800">
              <Wrench className="h-3 w-3" aria-hidden="true" />
              {category.providerCount > 0
                ? `${pluralize(category.providerCount, 'approved provider')} with an active listing`
                : 'No approved providers listed yet'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:flex-col">
          <Link to="/services" className={buttonStyles({ variant: 'secondary', size: 'sm' })}>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All services
          </Link>
          <Link
            to={`/providers?category=${encodeURIComponent(category.slug)}`}
            className={buttonStyles({ variant: 'ghost', size: 'sm' })}
          >
            Open full filters
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-10">
        <ProvidersDirectory
          lockedCategorySlug={category.slug}
          title={`Providers for ${category.name}`}
          description="Only approved providers with an active service in this category appear here. Use the filters to narrow results by location, price, rating, or verification."
        />
      </div>

      {otherCategories.length > 0 ? (
        <div className="mt-12 border-t border-line pt-6">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Other services</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {otherCategories.map((row) => (
              <Link
                key={row.id}
                to={`/services/${row.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-soft px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
              >
                {row.name}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

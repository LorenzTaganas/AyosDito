import { Link } from 'react-router-dom';
import { ArrowRight, Search, ShieldCheck, Wrench } from 'lucide-react';
import type { CategoryDto } from '@shared/api-types';
import { useCategories } from '@/hooks/catalog';
import { categoryIcon } from '@/lib/categoryIcons';
import { pluralize } from '@/lib/format';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/ui/Brand';
import { IconTile } from '@/components/ui/Avatar';
import { buttonStyles } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';

function ServiceCategoryCard({ category }: { category: CategoryDto }) {
  const Icon = categoryIcon(category.icon);
  return (
    <Link
      to={`/services/${category.slug}`}
      className="group card-surface flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <IconTile icon={Icon} />
        <ArrowRight
          className="mt-1 h-4 w-4 text-ink-mute transition group-hover:translate-x-0.5 group-hover:text-brand-700"
          aria-hidden="true"
        />
      </div>
      <h2 className="mt-4 text-base font-bold leading-snug group-hover:text-brand-800">{category.name}</h2>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-soft">
        {category.description ?? 'Local providers for this service category.'}
      </p>
      <p className="mt-4 border-t border-line/80 pt-3 text-xs font-semibold text-ink-mute">
        {category.providerCount > 0
          ? `${pluralize(category.providerCount, 'approved provider')} with an active service`
          : 'No approved providers listed yet'}
      </p>
    </Link>
  );
}

export function ServicesPage() {
  useDocumentTitle('Services');
  const categories = useCategories();

  return (
    <div className="page-shell py-10 sm:py-14">
      <nav className="mb-6 text-xs font-medium text-ink-mute" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-700">
          Home
        </Link>
        <span className="mx-1.5" aria-hidden="true">
          /
        </span>
        <span aria-current="page" className="text-ink-soft">
          Services
        </span>
      </nav>

      <PageHeader
        eyebrow="Service catalog"
        title="Repairs and home services, sorted clearly."
        description="Choose the type of work you need. Each category opens the provider directory filtered to approved providers with an active service in that category. Counts are live, not marketing numbers."
        actions={
          <Link to="/providers" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Search all providers
          </Link>
        }
      />

      <div className="mt-9">
        {categories.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : categories.isError ? (
          <ErrorState
            message="The service catalog could not be loaded. Check that the AyosDito API is running, then try again."
            onRetry={() => categories.refetch()}
          />
        ) : categories.data.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-5 w-5" aria-hidden="true" />}
            title="No active service categories yet"
            description="An administrator has not published any active categories. Check back after the catalog is configured."
          />
        ) : (
          <>
            <div className="mb-5 flex items-center gap-2 text-xs text-ink-mute">
              <span className="font-semibold text-ink-soft">{categories.data.length}</span> active
              {categories.data.length === 1 ? ' category' : ' categories'} in the live catalog
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.data.map((category) => (
                <ServiceCategoryCard key={category.id} category={category} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-sun/40 bg-sun-soft/60 p-6">
          <ShieldCheck className="h-6 w-6 text-sun-deep" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold">What a listing does and does not mean</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            A listed provider has an administrator-approved profile and at least one active service in
            this category. It does not automatically mean they are identity-verified, and it is not a
            guarantee of workmanship. Look for the verification badge and compare quotes.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-paper-soft p-6">
          <Wrench className="h-6 w-6 text-brand-700" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold">Have a different kind of repair?</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Start with the closest category and describe the problem clearly in your quote request.
            Providers can tell you if the job needs a specialist. Categories are managed by site
            administrators.
          </p>
          <Link to="/providers" className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'mt-4' })}>
            Browse all providers
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

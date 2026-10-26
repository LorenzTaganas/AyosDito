import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import type { ProviderSummary } from '@shared/api-types';
import { categoryIcon } from '@/lib/categoryIcons';
import { formatPeso, locationLabel, pluralize, truncate } from '@/lib/format';
import { buttonStyles } from '@/components/ui/Button';
import { Avatar, IconTile } from '@/components/ui/Avatar';
import { DemoBadge, VerificationBadges } from '@/components/ui/Verification';
import { Rating } from '@/components/ui/Stars';

export function ProviderCard({ provider, action }: { provider: ProviderSummary; action?: ReactNode }) {
  const visibleCategories = provider.categories.slice(0, 3);
  const extraCategories = provider.categories.length - visibleCategories.length;
  const areas = provider.serviceAreas.slice(0, 2);
  return (
    <article className="group card-surface flex h-full flex-col p-5 transition hover:border-brand-200 hover:shadow-lift">
      <div className="flex items-start gap-4">
        <Avatar name={provider.businessName} imageUrl={provider.profileImage} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="min-w-0 text-base font-bold leading-snug">
              <Link
                to={`/providers/${provider.id}`}
                className="rounded-sm hover:text-brand-800 focus-visible:ring-offset-paper-soft"
              >
                {provider.businessName}
              </Link>
            </h3>
            {provider.isDemo ? <DemoBadge /> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Rating rating={provider.ratingAvg} count={provider.reviewCount} />
            <span className="text-line" aria-hidden="true">·</span>
            <VerificationBadges
              identityVerified={provider.identityVerified}
              businessVerified={provider.businessVerified}
              compact
            />
          </div>
          {provider.yearsOfExperience ? (
            <p className="mt-1.5 text-xs font-medium text-ink-mute">
              {pluralize(provider.yearsOfExperience, 'year')} of experience · self-reported
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <p className="mt-4 min-h-[2.5rem] text-sm leading-relaxed text-ink-soft">
        {truncate(provider.description, 150) || 'This provider has not added a description yet.'}
      </p>

      {visibleCategories.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visibleCategories.map((category) => {
            const Icon = categoryIcon(category.icon);
            return (
              <span
                key={category.id}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2 py-1 text-[11px] font-semibold text-ink-soft"
              >
                <Icon className="h-3 w-3 text-brand-600" aria-hidden="true" />
                {category.name}
              </span>
            );
          })}
          {extraCategories > 0 ? (
            <span className="inline-flex items-center rounded-full border border-line bg-paper px-2 py-1 text-[11px] font-semibold text-ink-mute">
              +{extraCategories} more
            </span>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-mute">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden="true" />
        <span>{areas.length > 0 ? areas.map(locationLabel).join(' · ') : 'No service area listed yet'}</span>
      </p>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-line/80 pt-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Starting price</p>
          <p className="mt-0.5 text-lg font-extrabold text-ink">
            {provider.minStartingPrice !== null ? formatPeso(provider.minStartingPrice) : 'Ask for a quote'}
          </p>
          <p className="text-[10px] text-ink-mute">Estimate only; final quote may follow inspection.</p>
        </div>
        <Link
          to={`/providers/${provider.id}`}
          className={buttonStyles({ variant: 'secondary', size: 'sm', className: 'shrink-0' })}
          aria-label={`View ${provider.businessName} profile`}
        >
          View profile
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export function CategoryCard({ category }: { category: { name: string; slug: string; icon: string; providerCount: number } }) {
  const Icon = categoryIcon(category.icon);
  return (
    <Link
      to={`/services/${category.slug}`}
      className="group card-surface flex items-center gap-3.5 p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
    >
      <IconTile icon={Icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-ink group-hover:text-brand-800">{category.name}</span>
        <span className="mt-0.5 block text-xs text-ink-mute">
          {category.providerCount > 0 ? pluralize(category.providerCount, 'provider') : 'No providers listed yet'}
        </span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-ink-mute transition group-hover:translate-x-0.5 group-hover:text-brand-700"
        aria-hidden="true"
      />
    </Link>
  );
}

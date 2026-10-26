import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HeartOff, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { ProviderSummary } from '@shared/api-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useDocumentTitle } from '@/auth/AuthProvider';
import { PageHeader } from '@/components/ui/Brand';
import { buttonStyles } from '@/components/ui/Button';
import { EmptyState, ErrorState, ProviderCardSkeleton } from '@/components/ui/Feedback';
import { Pagination } from '@/components/ui/Pagination';
import { ProviderCard } from '@/components/providers/ProviderCard';

export function FavoritesPage() {
  useDocumentTitle('Saved providers');
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
  const queryClient = useQueryClient();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const favorites = useQuery({
    queryKey: queryKeys.favorites(page),
    queryFn: () => api.list<ProviderSummary>('/favorites', { page, pageSize: 9 }),
  });

  const removeFavorite = useMutation({
    mutationFn: (providerId: string) => api.delete(`/favorites/${providerId}`),
    onSuccess: async (_data, providerId) => {
      toast.success('Removed from saved providers.');
      setRemovingId(null);
      await queryClient.invalidateQueries({ queryKey: ['favorites'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.customerDashboard });
      await queryClient.invalidateQueries({ queryKey: queryKeys.provider(providerId) });
    },
    onError: (error) => {
      setRemovingId(null);
      toast.error(error instanceof Error ? error.message : 'Could not remove this provider.');
    },
  });

  function setPage(nextPage: number) {
    const next = new URLSearchParams(params);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Saved providers"
        title="Your shortlist"
        description="Saved providers stay here for easy comparison. Saving is not a rating, booking, or endorsement."
        actions={
          <Link to="/providers" className={buttonStyles({ variant: 'secondary', size: 'md' })}>
            <Search className="h-4 w-4" aria-hidden="true" />
            Find more providers
          </Link>
        }
      />

      {favorites.isPending ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
          <ProviderCardSkeleton />
          <ProviderCardSkeleton />
        </div>
      ) : favorites.isError ? (
        <ErrorState
          message="We could not load your saved providers. Check your connection and try again."
          onRetry={() => favorites.refetch()}
        />
      ) : favorites.data.data.length === 0 ? (
        <EmptyState
          icon={<HeartOff className="h-5 w-5" aria-hidden="true" />}
          title="No saved providers yet"
          description="Use the save button on a provider profile or directory card to keep it here while you compare options."
          action={
            <Link to="/providers" className={buttonStyles({ variant: 'primary', size: 'md' })}>
              Browse the directory
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-xs font-semibold text-ink-mute">
            {favorites.data.meta.total} saved {favorites.data.meta.total === 1 ? 'provider' : 'providers'}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {favorites.data.data.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setRemovingId(provider.id);
                      removeFavorite.mutate(provider.id);
                    }}
                    disabled={removeFavorite.isPending && removingId === provider.id}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-paper-soft px-2.5 text-xs font-semibold text-ink-soft transition hover:border-clay/30 hover:text-clay disabled:opacity-50"
                    aria-label={`Remove ${provider.businessName} from saved providers`}
                    title="Remove from saved providers"
                  >
                    <HeartOff className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                }
              />
            ))}
          </div>
          <Pagination
            page={favorites.data.meta.page}
            pageSize={favorites.data.meta.pageSize}
            total={favorites.data.meta.total}
            totalPages={favorites.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <p className="text-xs leading-relaxed text-ink-mute">
        A saved provider may change their services or approval status. The directory only displays
        approved providers with an active service and supported area at the time you view it.
      </p>
    </div>
  );
}

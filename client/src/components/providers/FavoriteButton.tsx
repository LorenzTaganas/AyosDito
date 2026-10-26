import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/auth/AuthProvider';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';

export function FavoriteButton({
  providerId,
  initialFavorite,
  showLabel = true,
  variant = 'secondary',
  size = 'md',
}: {
  providerId: string;
  initialFavorite: boolean;
  showLabel?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const { user, isLoading } = useAuth();
  const [favorite, setFavorite] = useState(initialFavorite);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => setFavorite(initialFavorite), [initialFavorite]);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) await api.post(`/favorites/${providerId}`);
      else await api.delete(`/favorites/${providerId}`);
      return next;
    },
    onSuccess: (next) => {
      setFavorite(next);
      toast.success(next ? 'Saved to your favorites.' : 'Removed from favorites.');
      queryClient.invalidateQueries({ queryKey: queryKeys.provider(providerId) });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not update your favorites.');
    },
  });

  if (isLoading || user?.role === 'PROVIDER' || user?.role === 'ADMIN') return null;

  function handleClick() {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?next=${next}`);
      return;
    }
    mutation.mutate(!favorite);
  }

  return (
    <Button
      type="button"
      variant={favorite ? 'subtle' : variant}
      size={size}
      onClick={handleClick}
      loading={mutation.isPending}
      aria-pressed={favorite}
      aria-label={favorite ? 'Remove from favorites' : 'Save to favorites'}
      title={favorite ? 'Remove from favorites' : 'Save to favorites'}
    >
      <Heart className={favorite ? 'h-4 w-4 fill-brand-700 text-brand-700' : 'h-4 w-4'} aria-hidden="true" />
      {showLabel ? (favorite ? 'Saved' : 'Save') : null}
    </Button>
  );
}

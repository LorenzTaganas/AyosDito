import { useQuery } from '@tanstack/react-query';
import type { CategoryDto, LocationDto } from '@shared/api-types';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.get<CategoryDto[]>('/categories'),
    staleTime: 5 * 60_000,
  });
}

export function useLocations() {
  return useQuery({
    queryKey: queryKeys.locations,
    queryFn: () => api.get<LocationDto[]>('/locations'),
    staleTime: 5 * 60_000,
  });
}

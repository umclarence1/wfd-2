import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export const packagesQueryOptions = {
  queryKey: ['packages'],
  queryFn: () => api.get('/packages').then((r) => r.data.packages),
  staleTime: 2 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: 1,
  placeholderData: (previousData) => previousData ?? [],
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchInterval: false,
};

export function usePackages() {
  return useQuery(packagesQueryOptions);
}

export function usePackagesByCategory(category) {
  const query = usePackages();
  const packages = (query.data || []).filter((p) => p.category === category);
  return { ...query, packages };
}

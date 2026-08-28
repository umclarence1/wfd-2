import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

/** Live checker stock from TopDealsGH — never cached in localStorage. */
export const checkerPackagesQueryOptions = {
  queryKey: ['checker-packages'],
  queryFn: () =>
    api
      .get('/packages', { params: { serviceType: 'result_checker' } })
      .then((r) => r.data.packages),
  staleTime: 30_000,
  gcTime: 5 * 60_000,
  retry: 2,
  refetchOnMount: 'always',
  refetchOnWindowFocus: true,
};

export function useCheckerPackages() {
  return useQuery(checkerPackagesQueryOptions);
}

export function useCheckerPackagesByCategory(category) {
  const query = useCheckerPackages();
  const packages = (query.data || []).filter((p) => p.category === category);
  return { ...query, packages };
}

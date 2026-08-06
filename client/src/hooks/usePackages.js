import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

const PACKAGES_CACHE_KEY = 'wds_packages_cache_v1';

const readCachedPackages = () => {
  try {
    const raw = localStorage.getItem(PACKAGES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCachedPackages = (packages) => {
  try {
    if (Array.isArray(packages) && packages.length) {
      localStorage.setItem(PACKAGES_CACHE_KEY, JSON.stringify(packages));
    }
  } catch {
    // ignore quota / private mode
  }
};

export const packagesQueryOptions = {
  queryKey: ['packages'],
  queryFn: async () => {
    const packages = await api.get('/packages').then((r) => r.data.packages);
    writeCachedPackages(packages);
    return packages;
  },
  // Show cached packages immediately so network pages don't flash "Loading..."
  initialData: () => {
    const cached = readCachedPackages();
    return cached.length ? cached : undefined;
  },
  initialDataUpdatedAt: () => {
    const cached = readCachedPackages();
    return cached.length ? Date.now() - 30_000 : 0;
  },
  staleTime: 10 * 60 * 1000,
  gcTime: 60 * 60 * 1000,
  retry: 1,
  placeholderData: (previousData) => previousData ?? readCachedPackages(),
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

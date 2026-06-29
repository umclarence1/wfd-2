import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../api/client';
import { PackageSkeleton } from '../ui/Skeleton';
import { formatCurrency } from '../../utils/validation';
import { getNetworkBrandColors } from '../../constants/networkColors';

export default function PackageSelector({
  category,
  selected,
  onSelect,
  summaryOnly = false,
  hideSummary = false,
}) {
  const { data: packages = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['packages', category],
    queryFn: () => api.get('/packages', { params: { category } }).then((r) => r.data.packages),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const available = packages.filter((p) => p.isActive !== false && p.isAvailable !== false);

  useEffect(() => {
    if (!summaryOnly || selected || available.length !== 1) return;
    onSelect(available[0]);
  }, [summaryOnly, available, selected, onSelect]);

  if (isLoading) return <PackageSkeleton />;

  if (isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center text-red-200">
        <p>Could not load packages. Is the server running?</p>
        <button type="button" onClick={() => refetch()} className="btn-secondary mt-3 !py-2 text-sm">Retry</button>
      </div>
    );
  }

  if (!available.length) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
        No packages available. Please check back later.
      </div>
    );
  }

  const brand = getNetworkBrandColors(category);

  return (
    <div>
      {!summaryOnly && (
        <div className="flex flex-wrap gap-3">
          {available.map((pkg) => {
            const label = pkg.dataAmount || pkg.name.replace(category, '').trim() || pkg.name;
            const isActive = selected?._id === pkg._id;
            return (
              <button
                key={pkg._id}
                type="button"
                onClick={() => onSelect(pkg)}
                className={`pill-btn ${brand.pillHover} ${isActive ? brand.pillActive : ''}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        {selected && !hideSummary && (
          <motion.div
            key={selected._id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`rounded-xl border p-4 transition-all duration-300 ease-out hover:shadow-md ${brand.summaryBox} ${summaryOnly ? '' : 'mt-6'}`}
          >
            <p className="text-sm text-gray-600">
              Selected:{' '}
              <span className="font-bold text-gray-900">{selected.dataAmount || selected.name}</span>
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Price: <span className={`font-bold ${brand.accent}`}>{formatCurrency(selected.price)}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {summaryOnly && !selected && !isLoading && available.length > 0 && (
        <p className="text-sm text-gray-500">Loading checker details...</p>
      )}

      {summaryOnly && !isLoading && !available.length && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          This checker is currently out of stock.
        </p>
      )}
    </div>
  );
}

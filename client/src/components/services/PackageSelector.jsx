import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePackagesByCategory } from '../../hooks/usePackages';
import { formatCurrency } from '../../utils/validation';
import { getNetworkBrandColors } from '../../constants/networkColors';

export default function PackageSelector({
  category,
  selected,
  onSelect,
  summaryOnly = false,
  hideSummary = false,
}) {
  const { packages, isError, refetch, isFetching } = usePackagesByCategory(category);

  const available = packages.filter((p) => p.isActive !== false && p.isAvailable !== false);

  useEffect(() => {
    if (!summaryOnly || selected || available.length !== 1) return;
    onSelect(available[0]);
  }, [summaryOnly, available, selected, onSelect]);

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-medium text-red-800">
        <p>Could not load packages. Is the server running?</p>
        <button type="button" onClick={() => refetch()} className="btn-secondary mt-3 !py-2 text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!available.length) {
    if (isFetching) {
      return <p className="text-sm font-medium text-gray-600">Loading packages...</p>;
    }
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-900">
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
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

      {summaryOnly && !selected && isFetching && (
        <p className="text-sm font-medium text-gray-600">Loading checker details...</p>
      )}

      {summaryOnly && !isFetching && !available.length && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-800">
          This checker is currently out of stock.
        </p>
      )}
    </div>
  );
}

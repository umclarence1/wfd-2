import { useEffect } from 'react';
import { usePackagesByCategory } from '../../hooks/usePackages';
import { getNetworkBrandColors } from '../../constants/networkColors';

export default function PackageSelector({
  category,
  selected,
  onSelect,
  summaryOnly = false,
  packagesOverride = null,
}) {
  const hook = usePackagesByCategory(category);
  const packages = packagesOverride || hook.packages;
  const isError = packagesOverride ? false : hook.isError;
  const refetch = hook.refetch;
  const isFetching = packagesOverride ? false : hook.isFetching;

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

  if (summaryOnly) {
    if (!selected && isFetching) {
      return <p className="text-sm font-medium text-gray-600">Loading checker details...</p>;
    }
    if (!isFetching && !available.length) {
      return (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-800">
          This checker is currently out of stock.
        </p>
      );
    }
    return null;
  }

  const brand = getNetworkBrandColors(category);

  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
      {available.map((pkg) => {
        const label = pkg.dataAmount || pkg.name.replace(category, '').trim() || pkg.name;
        const isActive = selected?._id === pkg._id;
        return (
          <button
            key={pkg._id}
            type="button"
            onClick={() => onSelect(pkg)}
            className={`pkg-box ${brand.boxHover || ''} ${isActive ? brand.boxActive || 'pkg-box-active' : ''}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

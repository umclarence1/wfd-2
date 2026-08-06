import { usePackagesByCategory } from '../../hooks/usePackages';
import { getNetworkBrandColors } from '../../constants/networkColors';
import { useEffect } from 'react';

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
  const catalogReady = packagesOverride
    ? true
    : Array.isArray(hook.data) && hook.data.length > 0;
  const isLoadingCatalog = packagesOverride
    ? false
    : !catalogReady && (hook.isPending || hook.isFetching);

  const available = packages.filter((p) => p.isActive !== false && p.isAvailable !== false);

  useEffect(() => {
    if (!summaryOnly || selected || available.length !== 1) return;
    onSelect(available[0]);
  }, [summaryOnly, available, selected, onSelect]);

  if (isError && !catalogReady) {
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
    if (isLoadingCatalog) {
      return <p className="text-sm font-medium text-gray-600">Loading packages...</p>;
    }
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-900">
        No packages available. Please check back later.
      </div>
    );
  }

  if (summaryOnly) {
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

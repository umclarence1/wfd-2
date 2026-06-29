export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800 ${className}`} />
);

export const PackageSkeleton = () => (
  <div className="flex flex-wrap gap-3">
    {Array.from({ length: 8 }).map((_, i) => (
      <Skeleton key={i} className="h-10 w-20 rounded-full" />
    ))}
  </div>
);

export const CardSkeleton = () => (
  <div className="card space-y-4">
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-10 w-full" />
  </div>
);

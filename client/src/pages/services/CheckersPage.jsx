import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import PurchaseForm from '../../components/services/PurchaseForm';
import { usePackages } from '../../hooks/usePackages';

export const CHECKER_EXAM_TYPES = [
  { id: 'BECE Checker', label: 'BECE', checkerType: 'BECE' },
  { id: 'WASSCE Checker', label: 'WASSCE', checkerType: 'WASSCE' },
];

export default function CheckersPage() {
  const [examType, setExamType] = useState(null);
  const { data: packages = [], isFetching, isPending } = usePackages();

  // Only show exam types that are on sale locally and in stock on TopDealsGH.
  const availableExamTypes = useMemo(() => {
    return CHECKER_EXAM_TYPES.filter((opt) =>
      (packages || []).some(
        (p) =>
          p.category === opt.id &&
          p.serviceType === 'result_checker' &&
          p.isActive !== false &&
          p.adminPaused !== true &&
          p.isAvailable !== false
      )
    );
  }, [packages]);

  useEffect(() => {
    if (!availableExamTypes.length) {
      setExamType(null);
      return;
    }
    if (availableExamTypes.length === 1) {
      setExamType(availableExamTypes[0].id);
      return;
    }
    if (examType && !availableExamTypes.some((o) => o.id === examType)) {
      setExamType(null);
    }
  }, [availableExamTypes, examType]);

  const stillLoading = (isPending || isFetching) && !(packages || []).length;

  if (stillLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        </div>
        <p className="mt-8 text-sm text-gray-500">Loading Result Checker...</p>
      </div>
    );
  }

  if (availableExamTypes.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-xl font-bold text-gray-900">Result Checker</h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-semibold text-amber-900">
          No checkers available right now. Please check back later.
        </div>
      </div>
    );
  }

  return (
    <PurchaseForm
      category={examType ?? ''}
      title="Result Checker"
      checkerExamType={examType}
      checkerExamOptions={availableExamTypes}
      onCheckerExamTypeChange={setExamType}
    />
  );
}

export function CheckerRedirect() {
  return <Navigate to="/services/checkers" replace />;
}

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
  const { data: packages = [], isFetching, refetch } = usePackages();

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
    // Fresh stock when opening Result Checker (TopDeals can change).
    refetch();
  }, [refetch]);

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

  if (!isFetching && availableExamTypes.length === 0) {
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
      key={examType ?? 'none'}
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

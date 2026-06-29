import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import PurchaseForm from '../../components/services/PurchaseForm';

export const CHECKER_EXAM_TYPES = [
  { id: 'BECE Checker', label: 'BECE' },
  { id: 'WASSCE Checker', label: 'WASSCE' },
];

export default function CheckersPage() {
  const [examType, setExamType] = useState(null);

  return (
    <PurchaseForm
      key={examType ?? 'none'}
      category={examType ?? ''}
      title="Result Checker"
      checkerExamType={examType}
      checkerExamOptions={CHECKER_EXAM_TYPES}
      onCheckerExamTypeChange={setExamType}
    />
  );
}

export function CheckerRedirect() {
  return <Navigate to="/services/checkers" replace />;
}

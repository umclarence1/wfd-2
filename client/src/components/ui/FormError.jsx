import { AlertCircle } from 'lucide-react';

export function fieldClass(hasError) {
  return hasError ? 'input-field input-field-error' : 'input-field';
}

export default function FormError({ message }) {
  if (!message) return null;

  return (
    <p className="form-error" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

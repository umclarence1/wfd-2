import { useQuery } from '@tanstack/react-query';
import { Tag } from 'lucide-react';
import api from '../api/client';
import { formatCurrency, formatDate } from '../utils/validation';

const formatDiscount = (promo) => {
  if (promo.discountType === 'free') return 'Free';
  if (promo.discountType === 'percentage') return `${promo.discountValue}% off`;
  return `${formatCurrency(promo.discountValue)} off`;
};

export default function PromotionsPage() {
  const { data: promos = [], isLoading } = useQuery({
    queryKey: ['public-promos'],
    queryFn: () => api.get('/public/promos').then((r) => r.data.promos),
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="section-title">Promotions</h1>
      <p className="section-subtitle">Apply promo codes at checkout for discounts and free services.</p>

      {isLoading ? (
        <div className="mt-10 h-32 animate-pulse rounded-2xl bg-slate-100" />
      ) : promos.length > 0 ? (
        <div className="mt-10 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Available promo codes</h2>
          {promos.map((promo) => (
            <div key={promo._id} className="card flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                <Tag className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xl font-bold tracking-wide text-blue-700 dark:text-blue-400">
                  {promo.code}
                </p>
                {promo.description && (
                  <p className="mt-1 text-gray-600 dark:text-gray-400">{promo.description}</p>
                )}
                <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatDiscount(promo)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Valid until {formatDate(promo.expiryDate)}
                  {promo.usageLimit ? ` · ${promo.usageLimit - promo.usageCount} uses left` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-sm text-gray-500">No active promo codes right now. Check back soon.</p>
      )}

      <div className="card mt-10">
        <h3 className="font-bold">How to use promo codes</h3>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-gray-600 dark:text-gray-400">
          <li>Select your service and package</li>
          <li>Enter your phone number and email</li>
          <li>Enter your promo code and click Apply</li>
          <li>Proceed to payment with your discounted total</li>
        </ol>
        <p className="mt-4 text-sm text-gray-500">
          Each promo code can only be used once per email, phone number, and account.
        </p>
      </div>
    </div>
  );
}

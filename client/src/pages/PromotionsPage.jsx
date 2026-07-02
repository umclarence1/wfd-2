import { useQuery } from '@tanstack/react-query';
import { Tag } from 'lucide-react';
import api from '../api/client';

export default function PromotionsPage() {
  const { data, isFetching } = useQuery({
    queryKey: ['public-promos'],
    queryFn: () => api.get('/public/promos').then((r) => r.data),
    staleTime: 60_000,
  });

  const promoCheckoutEnabled = data?.promoCheckoutEnabled === true;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="section-title">Promotions</h1>
      <p className="section-subtitle">Apply promo codes at checkout when the store has promotions active.</p>

      {isFetching ? (
        <p className="mt-10 text-sm text-gray-500">Loading...</p>
      ) : promoCheckoutEnabled ? (
        <div className="card mt-10">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Tag className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-gray-900">Promotions are active</p>
              <p className="mt-1 text-sm text-gray-600">
                {data?.message || 'Enter your promo code during checkout to receive your discount.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-10 text-sm text-gray-500">No active promotions right now. Check back soon.</p>
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

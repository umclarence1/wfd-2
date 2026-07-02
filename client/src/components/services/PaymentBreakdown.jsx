import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../../utils/validation';

function getDisplayTotal(breakdown) {
  if (breakdown.isFreeOrder) return 0;
  if (breakdown.discountedPrice != null) return breakdown.discountedPrice;
  return Math.max(0, (breakdown.packagePrice ?? 0) - (breakdown.promoDiscount ?? 0));
}

export default function PaymentBreakdown({ breakdown, loading }) {
  if (!breakdown && loading) {
    return (
      <div className="card animate-pulse space-y-3">
        <div className="h-4 w-1/2 rounded bg-gray-200" />
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-6 w-1/3 rounded bg-gray-200" />
      </div>
    );
  }

  if (!breakdown) {
    return (
      <div className="card">
        <h3 className="mb-2 font-bold text-gray-900">Payment Breakdown</h3>
        <p className="text-sm text-gray-600">Select a package to see your total.</p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${breakdown.packagePrice}-${getDisplayTotal(breakdown)}`}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`card ${loading ? 'opacity-80' : ''}`}
      >
        <h3 className="mb-4 font-bold text-gray-900">Payment Breakdown</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Package Price</span>
            <span className="text-gray-900">{formatCurrency(breakdown.packagePrice)}</span>
          </div>
          {breakdown.promoDiscount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Promo Discount</span>
              <span>-{formatCurrency(breakdown.promoDiscount)}</span>
            </div>
          )}
          {breakdown.discountedPrice !== undefined && breakdown.discountedPrice !== breakdown.packagePrice && (
            <div className="flex justify-between">
              <span className="text-gray-600">Discounted Price</span>
              <span className="text-gray-900">{formatCurrency(breakdown.discountedPrice)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
            <span className="text-gray-900">Total Payable</span>
            <span className="text-blue-700">{formatCurrency(getDisplayTotal(breakdown))}</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

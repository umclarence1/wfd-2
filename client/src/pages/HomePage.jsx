import { motion } from 'framer-motion';
import DataPlanGrid, { DATA_PLANS } from '../components/services/DataPlanGrid';

const HOME_PLAN_IDS = ['mtn', 'telecel', 'airteltigo', 'afa', 'waec', 'web-dev'];

const dataPlans = HOME_PLAN_IDS.map((id) => DATA_PLANS.find((p) => p.id === id)).filter(Boolean);

export default function HomePage() {
  return (
    <div className="px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <h1 className="max-w-3xl text-base font-bold tracking-tight text-gray-900 sm:text-lg">
            Affordable Data Bundles, Results Checkers &amp; Modern Websites
          </h1>
          <p className="mt-2 max-w-3xl text-xs font-bold leading-relaxed tracking-tight text-gray-900 sm:text-sm">
            Buy data on MTN, Telecel &amp; AirtelTigo. Purchase BECE &amp; WASSCE result checkers.
            Need a professional and modern website for your business? We&apos;ve got you covered.
          </p>
        </motion.div>

        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
        >
          <DataPlanGrid plans={dataPlans} />
        </motion.div>
      </div>
    </div>
  );
}

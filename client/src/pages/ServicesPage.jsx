import { motion } from 'framer-motion';
import DataPlanGrid from '../components/services/DataPlanGrid';

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <h1 className="section-title !text-2xl sm:!text-3xl">
          Our <span className="gradient-text">Services</span>
        </h1>
        <p className="mt-2 text-sm text-gray-600">Tap a service to view plans or get started.</p>
      </motion.div>
      <motion.div
        className="mt-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
      >
        <DataPlanGrid />
      </motion.div>
    </div>
  );
}

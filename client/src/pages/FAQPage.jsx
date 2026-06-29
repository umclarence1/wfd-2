import { motion } from 'framer-motion';
import FaqAccordion from '../components/shared/FaqAccordion';
import { FAQ_ITEMS } from '../constants/faqs';

export default function FAQPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="section-title">Frequently Asked Questions</h1>
        <p className="section-subtitle">
          Quick answers about delivery times, payments, and our services.
        </p>
      </motion.div>

      <div className="mt-10">
        <FaqAccordion items={FAQ_ITEMS} defaultOpen={0} />
      </div>
    </div>
  );
}

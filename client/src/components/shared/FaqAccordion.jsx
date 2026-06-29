import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function FaqAnswer({ item }) {
  if (item.bullets?.length) {
    return (
      <ul className="space-y-2">
        {item.bullets.map((line) => (
          <li key={line} className="flex gap-2.5">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    );
  }

  return <p>{item.a}</p>;
}

export default function FaqAccordion({ items, defaultOpen = null }) {
  const [openIndex, setOpenIndex] = useState(defaultOpen);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <div
            key={item.q}
            className={`overflow-hidden rounded-2xl border bg-white transition-all duration-300 ease-out ${
              isOpen
                ? 'border-blue-300 shadow-md'
                : 'border-gray-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors duration-200 hover:bg-gray-50/80 sm:px-6 sm:py-5 group"
              aria-expanded={isOpen}
            >
              <span className={`text-sm font-semibold leading-snug sm:text-base ${isOpen ? 'text-blue-700' : 'text-gray-900'}`}>
                {item.q}
              </span>
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                  isOpen ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                }`}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: 'easeInOut' }}
                >
                  <div className="border-t border-gray-100 px-5 pb-5 pt-1 text-sm leading-relaxed text-gray-600 sm:px-6 sm:pb-6 sm:text-base">
                    <FaqAnswer item={item} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

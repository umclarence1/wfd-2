import { motion } from 'framer-motion';
import { Globe, MessageCircle } from 'lucide-react';
import { WHATSAPP_WEB_DEV_URL } from '../../constants/brand';

export default function WebDevelopmentPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="text-center"
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg sm:h-24 sm:w-24">
          <Globe className="h-10 w-10 sm:h-12 sm:w-12" />
        </div>
        <h1 className="section-title mt-6 !text-2xl md:!text-3xl">Book a Service</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base">
          Need a professional and modern website for your business? Tap below to chat with us on
          WhatsApp and we&apos;ll help you get started.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
        className="card mt-8 text-center"
      >
        <p className="text-sm text-gray-600">
          Tell us about your business and what you need. We&apos;ll reply with options and a quote.
        </p>
        <a
          href={WHATSAPP_WEB_DEV_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-6 inline-flex w-full sm:w-auto"
        >
          <MessageCircle className="h-5 w-5" />
          Book a Service on WhatsApp
        </a>
      </motion.div>
    </div>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { Download, Smartphone, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { SITE_NAME } from '../../constants/brand';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

export default function InstallPrompt() {
  const location = useLocation();
  const { visible, isIos, install, dismiss } = useInstallPrompt();
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isAdminRoute) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4"
        >
          <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-xl shadow-blue-900/10 sm:px-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Smartphone className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-gray-900">
                Install {SITE_NAME}
              </p>
              <p className="truncate text-xs text-gray-500">
                {isIos
                  ? 'Tap Share (↑) → Add to Home Screen'
                  : 'Add to home screen for quick access'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={dismiss}
                className="hidden px-2 py-1.5 text-xs font-semibold text-gray-400 sm:inline"
              >
                Not now
              </button>
              {!isIos && (
                <button
                  type="button"
                  onClick={install}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

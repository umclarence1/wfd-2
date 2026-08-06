import { RESELLER_URL } from '../../constants/brand';

export default function Footer() {
  return (
    <footer className="mt-auto">
      <a
        href={RESELLER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full bg-blue-600 px-5 py-8 text-left transition-opacity hover:opacity-95 active:opacity-90 sm:px-8 sm:py-10"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xl font-bold leading-snug text-white sm:text-2xl">
            Want to sell data and earn?
          </p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/95 sm:text-base">
            Create your own reseller store, set your prices, and share your link with customers.
          </p>
          <span className="mt-5 inline-flex rounded-md bg-[#c89624] px-5 py-2.5 text-sm font-medium text-black sm:mt-6 sm:px-6 sm:py-3 sm:text-base">
            Become a Reseller
          </span>
        </div>
      </a>

      <div className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
          <p className="text-center text-sm font-medium text-gray-500">
            &copy; 2026 Wilberforce Data Service. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

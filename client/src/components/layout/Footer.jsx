import { Link } from 'react-router-dom';

const serviceLinks = [
  { to: '/services/data/mtn', label: 'MTN Data Bundles' },
  { to: '/services/data/telecel', label: 'Telecel Data' },
  { to: '/services/afa', label: 'MTN AFA Registration' },
  { to: '/services/checkers', label: 'Result Checkers' },
  { to: '/services/web-development', label: 'Web Development' },
];

const linkClass = 'footer-link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:py-12">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Services
          </h3>
          <ul className="mt-5 space-y-3">
            {serviceLinks.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className={linkClass}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-8">
          <p className="text-center text-sm font-medium text-gray-500">
            &copy; 2026 Wilberforce. All right reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

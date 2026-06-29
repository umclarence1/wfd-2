import { Link, NavLink } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { SITE_NAME, RESELLER_URL } from '../../constants/brand';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/order-history', label: 'Order History' },
  { to: '/faq', label: 'FAQ' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/public/settings').then((r) => r.data.settings),
    staleTime: 0,
  });

  const settings = settingsData || {};

  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full bg-blue-600 shadow-md">
      {settings?.announcementBanner?.enabled && (
        <div className="border-b border-blue-500 bg-blue-700 px-4 py-2 text-center text-sm font-medium text-white">
          {settings.announcementBanner.link ? (
            <a href={settings.announcementBanner.link} className="hover:underline">
              {settings.announcementBanner.text}
            </a>
          ) : (
            settings.announcementBanner.text
          )}
        </div>
      )}

      <header>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5">
          <Link to="/" className="flex items-center transition-opacity duration-200 hover:opacity-90">
            <span className="text-base font-bold tracking-tight text-white sm:text-lg">
              {SITE_NAME}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-white hover:bg-white/15 hover:shadow-sm'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <a
              href={RESELLER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:bg-blue-50 hover:shadow-md"
            >
              Become a Reseller
            </a>
          </nav>

          <button
            type="button"
            className="rounded-lg p-2 text-white transition-all duration-200 hover:scale-105 hover:bg-white/15 lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-white/20 bg-blue-700 px-4 py-4 lg:hidden">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `mb-1 block rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 last:mb-0 ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-white hover:bg-white/15'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
            <a
              href={RESELLER_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="mt-3 block rounded-lg bg-white px-3 py-2.5 text-center text-sm font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:bg-blue-50"
            >
              Become a Reseller
            </a>
          </div>
        )}
      </header>
    </div>
  );
}

import { Link, NavLink } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
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
  const navRef = useRef(null);

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/public/settings').then((r) => r.data.settings),
    staleTime: 5 * 60 * 1000,
    placeholderData: {},
  });

  const settings = settingsData || {};
  const announcementText = String(settings?.announcementBanner?.text || '').trim();
  const announcementLink = String(settings?.announcementBanner?.link || '').trim();
  const showAnnouncement =
    Boolean(settings?.announcementBanner?.enabled) && Boolean(announcementText);
  const safeAnnouncementLink = /^https?:\/\//i.test(announcementLink)
    ? announcementLink
    : '';

  // Keep content padding aligned with the real (possibly taller) navbar height.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return undefined;

    const update = () => {
      document.documentElement.style.setProperty('--app-nav-height', `${el.offsetHeight}px`);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showAnnouncement, open]);

  return (
    <div
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 w-full bg-blue-600 pt-[env(safe-area-inset-top,0px)]"
    >
      <header className="bg-blue-600">
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

        {showAnnouncement && (
          <p className="px-4 pb-3 text-center text-xs font-medium leading-snug text-white/95 sm:text-sm">
            {safeAnnouncementLink ? (
              <a href={safeAnnouncementLink} className="hover:underline" rel="noopener noreferrer">
                {announcementText}
              </a>
            ) : (
              announcementText
            )}
          </p>
        )}

        {open && (
          <div className="border-t border-white/15 px-4 py-4 lg:hidden">
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

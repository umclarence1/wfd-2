import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Package,
  Tag,
  ShoppingBag,
  Settings,
  Plug,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import OfflineBanner from '../pwa/OfflineBanner';
import { useAuth } from '../../context/AuthContext';
import { SITE_NAME } from '../../constants/brand';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/search', label: 'Search', icon: Search },
  { to: '/admin/packages', label: 'Packages', icon: Package },
  { to: '/admin/promo-codes', label: 'Promo Codes', icon: Tag },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/api-providers', label: 'API Providers', icon: Plug },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="admin-shell min-h-screen lg:flex">
      <OfflineBanner />
      {sidebarOpen && (
        <button
          type="button"
          className="admin-sidebar-backdrop lg:hidden"
          aria-label="Close menu"
          onClick={closeSidebar}
        />
      )}

      <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar-open' : ''}`}>
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--admin-gold)]">Admin Panel</p>
            <h1 className="mt-1 text-lg font-bold leading-tight text-white">{SITE_NAME}</h1>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-white/80 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
            onClick={closeSidebar}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `admin-nav-link ${isActive ? 'admin-nav-link-active' : ''}`
              }
              onClick={closeSidebar}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="truncate px-3 text-xs text-slate-400">{user?.email}</p>
          <div className="mt-3 space-y-2">
            <Link to="/" className="admin-sidebar-btn">
              <ExternalLink className="h-4 w-4" />
              View Site
            </Link>
            <button type="button" onClick={handleLogout} className="admin-sidebar-btn w-full">
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-main flex min-h-screen flex-1 flex-col">
        <header className="admin-topbar">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="admin-menu-btn lg:hidden"
              aria-label="Open menu"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-gold)]">Admin</p>
              <p className="font-bold text-white">{SITE_NAME}</p>
            </div>
          </div>
          <button type="button" onClick={handleLogout} className="admin-gold-btn !py-2 text-sm lg:hidden">
            Logout
          </button>
        </header>

        <main className="admin-content flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

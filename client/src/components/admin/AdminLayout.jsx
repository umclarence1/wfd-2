import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Package,
  Tag,
  GraduationCap,
  ShoppingBag,
  Settings,
  Plug,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SITE_NAME } from '../../constants/brand';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/search', label: 'Search', icon: Search },
  { to: '/admin/packages', label: 'Packages', icon: Package },
  { to: '/admin/promo-codes', label: 'Promo Codes', icon: Tag },
  { to: '/admin/checkers', label: 'Results Checkers', icon: GraduationCap },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/api-providers', label: 'API Providers', icon: Plug },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="admin-shell min-h-screen lg:flex">
      <aside className="admin-sidebar">
        <div className="border-b border-white/10 px-5 py-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400/90">Admin Panel</p>
          <h1 className="mt-1 text-lg font-bold leading-tight text-white">{SITE_NAME}</h1>
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
        <header className="admin-topbar lg:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-500">Admin</p>
            <p className="font-bold text-slate-900">{SITE_NAME}</p>
          </div>
          <button type="button" onClick={handleLogout} className="btn-secondary !py-2 text-sm">
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

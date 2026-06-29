import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedAdminRoute() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="admin-login-bg flex min-h-screen items-center justify-center">
        <div className="rounded-2xl bg-white/10 px-6 py-4 text-sm font-medium text-white backdrop-blur">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}

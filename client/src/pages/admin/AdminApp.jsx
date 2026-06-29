import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import AdminLayout from '../../components/admin/AdminLayout';
import ProtectedAdminRoute from '../../components/admin/ProtectedAdminRoute';
import AdminLoginPage from './AdminLoginPage';
import AdminOverviewPage from './AdminOverviewPage';
import AdminSearchPage from './AdminSearchPage';
import AdminPackagesPage from './AdminPackagesPage';
import AdminPromoCodesPage from './AdminPromoCodesPage';
import AdminCheckersPage from './AdminCheckersPage';
import AdminOrdersPage from './AdminOrdersPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminApiProvidersPage from './AdminApiProvidersPage';

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<AdminLoginPage />} />
        <Route element={<ProtectedAdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminOverviewPage />} />
            <Route path="search" element={<AdminSearchPage />} />
            <Route path="packages" element={<AdminPackagesPage />} />
            <Route path="promo-codes" element={<AdminPromoCodesPage />} />
            <Route path="checkers" element={<AdminCheckersPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="api-providers" element={<AdminApiProvidersPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

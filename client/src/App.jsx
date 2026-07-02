import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import ServicesPage from './pages/ServicesPage';
import DataBundlePage from './pages/services/DataBundlePage';
import AFAPage from './pages/services/AFAPage';
import CheckersPage, { CheckerRedirect } from './pages/services/CheckersPage';
import WebDevelopmentPage from './pages/services/WebDevelopmentPage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import PaymentCallbackPage from './pages/PaymentCallbackPage';
import FAQPage from './pages/FAQPage';
import PromotionsPage from './pages/PromotionsPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import AdminApp from './pages/admin/AdminApp';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="admin/*" element={<AdminApp />} />
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="services" element={<ServicesPage />} />
                <Route path="services/data/mtn" element={<DataBundlePage category="MTN" title="MTN Data Bundles" />} />
                <Route path="services/data/telecel" element={<DataBundlePage category="Telecel" title="Telecel Data Bundles" />} />
                <Route path="services/data/airteltigo-bigtime" element={<Navigate to="/services/data/airteltigo" replace />} />
                <Route path="services/data/airteltigo" element={<DataBundlePage category="AirtelTigo" title="AirtelTigo Data Bundles" />} />
                <Route path="services/afa" element={<AFAPage />} />
                <Route path="services/checkers" element={<CheckersPage />} />
                <Route path="services/web-development" element={<WebDevelopmentPage />} />
                <Route path="services/checkers/bece" element={<CheckerRedirect />} />
                <Route path="services/checkers/wassce" element={<CheckerRedirect />} />
                <Route path="order-history" element={<OrderHistoryPage />} />
                <Route path="payment/callback" element={<PaymentCallbackPage />} />
                <Route path="contact" element={<Navigate to="/" replace />} />
                <Route path="faq" element={<FAQPage />} />
                <Route path="promotions" element={<PromotionsPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

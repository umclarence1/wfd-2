import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, CalendarDays, Wallet, Users, Clock, CheckCircle2, XCircle, GraduationCap } from 'lucide-react';
import api from '../../api/client';
import { formatCurrency } from '../../utils/validation';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatCard from '../../components/admin/AdminStatCard';

export default function AdminOverviewPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api.get('/admin/analytics').then((r) => r.data.analytics),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {['bg-blue-600', 'bg-violet-600', 'bg-emerald-600', 'bg-amber-500'].map((color, i) => (
          <div key={i} className={`h-28 animate-pulse rounded-2xl opacity-60 ${color}`} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="admin-panel text-sm text-red-600">
        Could not load analytics. Is the server running?
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Overview" subtitle="Welcome back — here is how your store is performing." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Total Orders" value={data.totalOrders} icon={ShoppingCart} tone="blue" />
        <AdminStatCard label="Orders Today" value={data.ordersToday} icon={CalendarDays} tone="violet" />
        <AdminStatCard label="Revenue" value={formatCurrency(data.revenue)} icon={Wallet} tone="emerald" />
        <AdminStatCard label="Customers" value={data.customers} icon={Users} tone="amber" />
      </div>

      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Delivery Status</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard label="Pending" value={data.pendingOrders} icon={Clock} tone="amber" />
          <AdminStatCard label="Delivered" value={data.deliveredOrders} icon={CheckCircle2} tone="emerald" />
          <AdminStatCard label="Failed" value={data.failedOrders} icon={XCircle} tone="rose" />
        </div>
      </div>

      {data.checkers && (
        <div className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-lg shadow-emerald-600/25 sm:p-6">
          <div className="flex items-center gap-3 border-b border-white/20 pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-bold">Checker Stock</h3>
              <p className="text-sm text-white/80">Available result checkers in inventory</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-white/15 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm">
              <p className="text-sm text-white/80">BECE available</p>
              <p className="mt-1 text-2xl font-bold">{data.checkers.bece?.unused ?? 0}</p>
            </div>
            <div className="rounded-xl bg-white/15 px-4 py-3 ring-1 ring-white/20 backdrop-blur-sm">
              <p className="text-sm text-white/80">WASSCE available</p>
              <p className="mt-1 text-2xl font-bold">{data.checkers.wassce?.unused ?? 0}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

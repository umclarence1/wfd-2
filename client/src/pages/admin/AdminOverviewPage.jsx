import { useQuery } from '@tanstack/react-query';
import {
  ShoppingCart,
  CalendarDays,
  Wallet,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import api from '../../api/client';
import { formatCurrency } from '../../utils/validation';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminStatCard from '../../components/admin/AdminStatCard';
import PromoCheckoutToggle from '../../components/admin/PromoCheckoutToggle';

export default function AdminOverviewPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api.get('/admin/analytics').then((r) => r.data.analytics),
  });

  const { data: topBalance } = useQuery({
    queryKey: ['admin-topdealsgh-balance'],
    queryFn: () => api.get('/admin/api-providers/topdealsgh/balance').then((r) => r.data),
    retry: false,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/10 bg-[#111827]" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-[#111827] p-5 text-sm text-rose-300">
        Could not load analytics. Is the server running?
      </div>
    );
  }

  const walletValue =
    topBalance?.balance != null
      ? formatCurrency(topBalance.balance)
      : '—';

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Overview" subtitle="Welcome back — store performance at a glance." />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-col gap-3 rounded-2xl border border-sky-500/25 bg-[#111827] p-5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-sky-400" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Recent Alerts</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
              <p className="text-xs font-semibold text-sky-300">Pending orders</p>
              <p className="mt-1 text-lg font-bold text-white">{data.pendingOrders ?? 0}</p>
              <p className="mt-1 text-xs text-sky-200/80">Waiting or queued for delivery</p>
            </div>
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-xs font-semibold text-amber-300">Failed orders</p>
              <p className="mt-1 text-lg font-bold text-white">{data.failedOrders ?? 0}</p>
              <p className="mt-1 text-xs text-amber-200/80">Need review or retry</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#111827] p-5 lg:w-[320px]">
          <PromoCheckoutToggle />
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Overview</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Total Orders"
            value={data.totalOrders ?? 0}
            hint="all time"
            icon={ShoppingCart}
            tone="blue"
          />
          <AdminStatCard
            label="Wallet Balance"
            value={walletValue}
            hint={topBalance?.balance != null ? 'available' : 'TopDealsGH'}
            icon={Wallet}
            tone="sky"
          />
          <AdminStatCard
            label="Revenue"
            value={formatCurrency(data.revenue)}
            hint="delivered orders"
            icon={CheckCircle2}
            tone="emerald"
          />
          <AdminStatCard
            label="Customers"
            value={data.customers ?? 0}
            hint="registered"
            icon={Users}
            tone="violet"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Order Activity</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Orders Today"
            value={data.ordersToday ?? 0}
            hint="paid today"
            icon={CalendarDays}
            tone="blue"
          />
          <AdminStatCard
            label="Pending"
            value={data.pendingOrders ?? 0}
            hint="in progress"
            icon={Clock}
            tone="amber"
          />
          <AdminStatCard
            label="Delivered"
            value={data.deliveredOrders ?? 0}
            hint="completed"
            icon={CheckCircle2}
            tone="emerald"
          />
          <AdminStatCard
            label="Failed"
            value={data.failedOrders ?? 0}
            hint="needs attention"
            icon={XCircle}
            tone="rose"
          />
        </div>
      </div>
    </div>
  );
}

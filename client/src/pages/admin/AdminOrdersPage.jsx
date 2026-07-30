import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Download, Search } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/validation';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import OrderProviderStatusModal, {
  OrderProviderStatusButton,
} from '../../components/admin/OrderProviderStatusModal';

const deliveryStatuses = [
  'pending',
  'processing',
  'verification',
  'delivered',
  'failed',
  'refunded',
  'cancelled',
];

const statusTabs = [
  { key: '', label: 'ALL' },
  { key: 'pending', label: 'PENDING' },
  { key: 'processing', label: 'PROCESSING' },
  { key: 'verification', label: 'VERIFICATION' },
  { key: 'delivered', label: 'DELIVERED' },
  { key: 'failed', label: 'FAILED' },
  { key: 'refunded', label: 'REFUNDED' },
  { key: 'cancelled', label: 'CANCELLED' },
];

const networkFilters = [
  { key: '', label: 'All networks' },
  { key: 'mtn', label: 'MTN only' },
  { key: 'telecel', label: 'Telecel only' },
  { key: 'airteltigo', label: 'AirtelTigo only' },
];

const deliveryBadgeClass = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-sky-100 text-sky-800',
  verification: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-gray-200 text-gray-700',
};

const formatStatusLabel = (value) => {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatBundle = (order) => {
  const name = order.packageName || order.package?.name || '—';
  const category = order.category || order.package?.category;
  const amount = order.package?.dataAmount;
  if (category && amount) return `${category} · ${amount}`;
  if (category && name.toLowerCase().includes(String(category).toLowerCase())) return name;
  if (category) return `${category} · ${name}`;
  return name;
};

const escapeCsv = (value) => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const downloadOrdersCsv = (orders, networkKey) => {
  const header = ['Order ID', 'Customer', 'Phone', 'Bundle', 'Amount', 'Payment', 'Status', 'Date'];
  const rows = orders.map((order) => [
    order.reference,
    order.email,
    order.phone,
    formatBundle(order),
    order.totalAmount,
    order.paymentStatus,
    order.deliveryStatus,
    order.createdAt ? new Date(order.createdAt).toISOString() : '',
  ]);

  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const suffix = networkKey || 'all';
  link.href = url;
  link.download = `orders-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export default function AdminOrdersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [network, setNetwork] = useState('');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('delivered');
  const [providerOrder, setProviderOrder] = useState(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-orders', status, network, search],
    queryFn: () =>
      api
        .get('/admin/orders', {
          params: {
            status: status || undefined,
            network: network || undefined,
            search: search || undefined,
            limit: 200,
          },
        })
        .then((r) => r.data),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: import.meta.env.PROD ? 60_000 : false,
  });

  const orders = data?.orders || [];
  const total = data?.pagination?.total ?? orders.length;
  const visibleIds = useMemo(() => orders.map((o) => o._id), [orders]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    setSelectedIds(new Set());
  }, [status, network, search]);

  const updateOrder = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/admin/orders/${id}/status`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast('Order status updated.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Update failed.', 'error'),
    onSettled: () => setUpdatingId(null),
  });

  const bulkUpdateOrders = useMutation({
    mutationFn: (payload) => api.patch('/admin/orders/bulk-status', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setSelectedIds(new Set());
      const count = res.data.modifiedCount ?? 0;
      toast(`Updated ${count} order${count === 1 ? '' : 's'}.`, 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Bulk update failed.', 'error'),
  });

  const handleDeliveryChange = (orderId, deliveryStatus) => {
    if (!deliveryStatus) return;
    const current = orders.find((o) => o._id === orderId)?.deliveryStatus;
    if (current === deliveryStatus) return;
    setUpdatingId(orderId);
    updateOrder.mutate({ id: orderId, deliveryStatus });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(visibleIds));
  };

  const toggleSelect = (orderId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const applyBulkUpdate = () => {
    if (selectedIds.size === 0) return;
    bulkUpdateOrders.mutate({
      orderIds: Array.from(selectedIds),
      deliveryStatus: bulkStatus,
    });
  };

  const purgeOrders = useMutation({
    mutationFn: () => api.delete('/admin/orders/purge-all', { data: { confirm: 'DELETE_ALL_ORDERS' } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] });
      setSelectedIds(new Set());
      const count = res.data.ordersDeleted ?? 0;
      toast(`Cleared ${count} order${count === 1 ? '' : 's'}.`, 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Could not clear orders.', 'error'),
  });

  const handlePurgeAll = () => {
    if (
      !window.confirm(
        'Delete ALL orders permanently? This cannot be undone. Use this before going live with a clean slate.'
      )
    ) {
      return;
    }
    if (window.prompt('Type DELETE to confirm') !== 'DELETE') {
      toast('Cancelled — type DELETE exactly to confirm.', 'error');
      return;
    }
    purgeOrders.mutate();
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchDraft.trim());
  };

  const handleExport = () => {
    if (!orders.length) {
      toast('No orders to export for the current filters.', 'error');
      return;
    }
    downloadOrdersCsv(orders, network || 'all');
    toast(`Exported ${orders.length} order${orders.length === 1 ? '' : 's'}.`, 'success');
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="admin-search-input"
            placeholder="Search phone numbers, order IDs, emails..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
        <button type="submit" className="admin-gold-btn shrink-0">
          <Search className="h-4 w-4" />
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader
          title="All Orders"
          subtitle={`Every store order — ${total} total`}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExport} className="admin-gold-btn !py-2">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {orders.length > 0 && (
            <button
              type="button"
              onClick={handlePurgeAll}
              disabled={purgeOrders.isPending}
              className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {purgeOrders.isPending ? 'Clearing...' : 'Clear all orders'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
            Filter / export by network
          </p>
          <div className="flex flex-wrap gap-2">
            {networkFilters.map((item) => (
              <button
                key={item.key || 'all'}
                type="button"
                onClick={() => setNetwork(item.key)}
                className={`admin-filter-pill ${network === item.key ? 'admin-filter-pill-active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Status</p>
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key || 'all'}
                type="button"
                onClick={() => setStatus(tab.key)}
                className={`admin-status-pill ${status === tab.key ? 'admin-status-pill-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[var(--admin-navy-2)] px-4 py-3 shadow-lg">
          <span className="flex items-center gap-2 text-sm font-bold text-white">
            <CheckSquare className="h-4 w-4 text-[var(--admin-gold)]" />
            {selectedIds.size} order{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <select
            className="rounded-lg border border-white/15 bg-[#0f172a] px-3 py-2 text-sm text-white"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            {deliveryStatuses.map((s) => (
              <option key={s} value={s}>
                {formatStatusLabel(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="admin-gold-btn !py-2 text-sm"
            disabled={bulkUpdateOrders.isPending}
            onClick={applyBulkUpdate}
          >
            {bulkUpdateOrders.isPending ? 'Updating...' : `Apply to ${selectedIds.size}`}
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-slate-400 hover:text-white"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {isLoading && <div className="admin-panel h-48 animate-pulse bg-white/5" />}
      {isError && <div className="admin-panel text-sm text-red-300">Could not load orders.</div>}

      {!isLoading && !isError && (
        <div className="admin-orders-table-wrap overflow-x-auto">
          <table className="admin-table min-w-[980px]">
            <thead>
              <tr>
                <th className="w-10 pl-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                    }}
                    onChange={toggleSelectAll}
                    aria-label="Select all orders"
                  />
                </th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Bundle</th>
                <th>Amount</th>
                <th className="min-w-[200px]">Status</th>
                <th>Date</th>
                <th className="pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    No orders found for the selected filters.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const isUpdating = updatingId === order._id && updateOrder.isPending;
                  const isSelected = selectedIds.has(order._id);

                  return (
                    <tr key={order._id} className={isSelected ? '[&>td]:!bg-[#ebe4d4]' : undefined}>
                      <td className="pl-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                          checked={isSelected}
                          onChange={() => toggleSelect(order._id)}
                          aria-label={`Select order ${order.reference}`}
                        />
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs font-semibold text-slate-900">
                        {order.reference}
                      </td>
                      <td className="max-w-[220px]">
                        <p className="truncate text-sm font-medium text-slate-900">{order.email}</p>
                        {order.paymentStatus !== 'paid' && (
                          <p className="mt-0.5 text-xs font-semibold uppercase text-slate-500">
                            Payment: {formatStatusLabel(order.paymentStatus)}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-sm font-medium text-slate-900">{order.phone}</td>
                      <td className="min-w-[140px] text-sm font-semibold text-slate-900">
                        {formatBundle(order)}
                      </td>
                      <td className="whitespace-nowrap font-bold text-slate-900">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td className="min-w-[200px]">
                        <div className="flex flex-col gap-2">
                          <span
                            className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${deliveryBadgeClass[order.deliveryStatus] || deliveryBadgeClass.pending}`}
                          >
                            {formatStatusLabel(order.deliveryStatus)}
                          </span>
                          <select
                            className="input-field !py-1.5 !text-xs"
                            value={order.deliveryStatus || 'pending'}
                            disabled={isUpdating}
                            onChange={(e) => handleDeliveryChange(order._id, e.target.value)}
                          >
                            {deliveryStatuses.map((s) => (
                              <option key={s} value={s}>
                                {formatStatusLabel(s)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-sm text-slate-600">{formatDate(order.createdAt)}</td>
                      <td className="pr-4">
                        <OrderProviderStatusButton onClick={() => setProviderOrder(order)} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <OrderProviderStatusModal
        order={providerOrder}
        open={Boolean(providerOrder)}
        onClose={() => setProviderOrder(null)}
        onSynced={() => queryClient.invalidateQueries({ queryKey: ['admin-orders'] })}
      />
    </div>
  );
}

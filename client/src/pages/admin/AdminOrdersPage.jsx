import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/validation';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

const deliveryStatuses = ['pending', 'processing', 'delivered', 'failed', 'refunded'];

const statusTabs = [
  { key: '', label: 'ALL' },
  { key: 'pending', label: 'PENDING' },
  { key: 'processing', label: 'PROCESSING' },
  { key: 'delivered', label: 'DELIVERED' },
  { key: 'failed', label: 'FAILED' },
  { key: 'refunded', label: 'CANCELLED' },
];

const networkFilters = [
  { key: '', label: 'All networks' },
  { key: 'mtn', label: 'MTN only' },
  { key: 'telecel', label: 'Telecel only' },
  { key: 'airteltigo', label: 'AirtelTigo only' },
];

const deliveryBadgeClass = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-slate-200 text-slate-700',
};

const paymentBadgeClass = {
  pending: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  refunded: 'bg-slate-100 text-slate-600',
};

const formatStatusLabel = (value) => {
  if (value === 'refunded') return 'Cancelled';
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function AdminOrdersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [network, setNetwork] = useState('');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('delivered');

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader
          title="All Orders"
          subtitle={`${total} order${total === 1 ? '' : 's'} from your store.`}
        />
        {orders.length > 0 && (
          <button
            type="button"
            onClick={handlePurgeAll}
            disabled={purgeOrders.isPending}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {purgeOrders.isPending ? 'Clearing...' : 'Clear all orders'}
          </button>
        )}
      </div>

      <div className="admin-panel space-y-4">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Filter by network</p>
          <div className="flex flex-wrap gap-2">
            {networkFilters.map((item) => (
              <button
                key={item.key || 'all'}
                type="button"
                onClick={() => setNetwork(item.key)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  network === item.key
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {statusTabs.map((tab) => (
            <button
              key={tab.key || 'all'}
              type="button"
              onClick={() => setStatus(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold tracking-wide transition ${
                status === tab.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          className="input-field w-full max-w-md"
          placeholder="Search order ID, email, phone, bundle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <span className="flex items-center gap-2 text-sm font-bold text-blue-900">
            <CheckSquare className="h-4 w-4" />
            {selectedIds.size} selected
          </span>
          <select
            className="input-field !w-auto !py-2 !text-sm"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            {deliveryStatuses.map((s) => (
              <option key={s} value={s}>
                Mark as {formatStatusLabel(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary !py-2 text-sm"
            disabled={bulkUpdateOrders.isPending}
            onClick={applyBulkUpdate}
          >
            {bulkUpdateOrders.isPending ? 'Updating...' : 'Apply to selected'}
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}

      {isLoading && <div className="admin-panel h-48 animate-pulse bg-slate-100" />}
      {isError && <div className="admin-panel text-sm text-red-600">Could not load orders.</div>}

      {!isLoading && !isError && (
        <div className="admin-panel overflow-x-auto !p-0 sm:!p-0">
          <table className="admin-table min-w-[1000px]">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
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
                <th>Payment</th>
                <th>Status</th>
                <th>Date</th>
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
                    <tr key={order._id} className={isSelected ? 'bg-blue-50/60' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={isSelected}
                          onChange={() => toggleSelect(order._id)}
                          aria-label={`Select order ${order.reference}`}
                        />
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs font-semibold text-slate-800">
                        {order.reference}
                      </td>
                      <td className="max-w-[200px] break-all text-sm text-slate-800">{order.email}</td>
                      <td className="whitespace-nowrap text-sm text-slate-800">{order.phone}</td>
                      <td className="min-w-[140px] text-sm font-medium text-slate-900">
                        {order.packageName || order.package?.name}
                      </td>
                      <td className="whitespace-nowrap font-semibold text-slate-900">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${paymentBadgeClass[order.paymentStatus] || paymentBadgeClass.pending}`}
                        >
                          {formatStatusLabel(order.paymentStatus)}
                        </span>
                      </td>
                      <td className="min-w-[180px]">
                        <div className="flex flex-col gap-2">
                          <span
                            className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-bold ${deliveryBadgeClass[order.deliveryStatus] || deliveryBadgeClass.pending}`}
                          >
                            {formatStatusLabel(order.deliveryStatus)}
                          </span>
                          <select
                            className="input-field !py-1.5 !text-xs"
                            value=""
                            disabled={isUpdating}
                            onChange={(e) => handleDeliveryChange(order._id, e.target.value)}
                          >
                            <option value="" disabled>
                              {isUpdating ? 'Saving...' : 'Update status'}
                            </option>
                            {deliveryStatuses.map((s) => (
                              <option key={s} value={s}>
                                Set {formatStatusLabel(s)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-sm text-slate-600">{formatDate(order.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/validation';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

const statuses = ['pending', 'processing', 'delivered', 'failed', 'refunded'];

export default function AdminOrdersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-orders', status, search],
    queryFn: () =>
      api
        .get('/admin/orders', { params: { status: status || undefined, search: search || undefined, limit: 50 } })
        .then((r) => r.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, deliveryStatus }) =>
      api.patch(`/admin/orders/${id}/status`, { status: deliveryStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast('Order status updated.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Update failed.', 'error'),
  });

  const orders = data?.orders || [];

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Orders" subtitle="Search orders and update delivery status." />

      <div className="admin-panel flex flex-wrap gap-3">
        <input
          className="input-field max-w-xs"
          placeholder="Search reference, email, phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input-field max-w-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <div className="admin-panel h-40 animate-pulse bg-slate-100" />}
      {isError && <div className="admin-panel text-sm text-red-600">Could not load orders.</div>}

      {!isLoading && !isError && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="admin-panel text-sm text-slate-500">No orders found.</div>
          ) : (
            orders.map((order) => (
              <div key={order._id} className="admin-panel">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="font-bold text-slate-900">{order.packageName || order.package?.name}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{order.reference}</p>
                  </div>
                  <p className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <p><span className="text-slate-500">Phone:</span> <span className="font-medium text-slate-800">{order.phone}</span></p>
                  <p><span className="text-slate-500">Email:</span> <span className="font-medium text-slate-800">{order.email}</span></p>
                  <p><span className="text-slate-500">Payment:</span> <span className="font-medium text-slate-800">{order.paymentStatus}</span></p>
                  <p><span className="text-slate-500">Date:</span> <span className="font-medium text-slate-800">{formatDate(order.createdAt)}</span></p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Status:</span>
                  <select
                    className="input-field !w-auto !py-2"
                    value={order.deliveryStatus}
                    onChange={(e) => updateStatus.mutate({ id: order._id, deliveryStatus: e.target.value })}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

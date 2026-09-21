import { useEffect, useState } from 'react';
import api from '../api/client';
import { useOnlineStatus } from '../context/OnlineContext';
import { getOfflineAwareErrorMessage, OFFLINE_ACTION_MESSAGE } from '../utils/offline';
import { useToast } from '../context/ToastContext';
import { getPaymentReferencesFromCookie } from '../utils/orderHistoryCookie';
import { Loader2 } from 'lucide-react';

const statusColors = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  verification: 'bg-violet-100 text-violet-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-slate-200 text-slate-700',
};

const formatNetwork = (category) => {
  if (!category) return '—';
  return String(category).replace(/\s+AFA$/i, '').trim() || category;
};

const formatGb = (order) => {
  if (order.dataAmount) return order.dataAmount;
  const name = order.packageName || '';
  const match = name.match(/\d+(?:\.\d+)?\s*GB/i);
  return match ? match[0].toUpperCase() : name || '—';
};

const formatDatePart = (createdAt) =>
  new Date(createdAt).toLocaleDateString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const formatTimePart = (createdAt) =>
  new Date(createdAt).toLocaleTimeString('en-GH', {
    hour: '2-digit',
    minute: '2-digit',
  });

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    const refs = getPaymentReferencesFromCookie();
    if (!refs.length) {
      setLoading(false);
      return;
    }

    if (!isOnline) {
      toast(OFFLINE_ACTION_MESSAGE, 'error');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post('/orders/history/by-references', {
          paymentReferences: refs,
        });
        if (!cancelled) setOrders(data.orders || []);
      } catch (err) {
        if (!cancelled) {
          toast(getOfflineAwareErrorMessage(err, 'Could not load order history.'), 'error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnline, toast]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="section-title">Order History</h1>
      <p className="section-subtitle">
        Orders you complete on this device appear here automatically — no login required.
      </p>

      {loading && (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm font-medium text-blue-700">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your orders…
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="card mt-8 text-center text-gray-600">
          <p className="font-medium">No orders on this device yet.</p>
          <p className="mt-2 text-sm">After you pay for a bundle or checker, your orders will show up here.</p>
        </div>
      )}

      {!loading && orders.length > 0 && (
        <div className="mt-8 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">GB</th>
                <th className="px-4 py-3">Paystack reference</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Network</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.paymentReference || order.reference} className="hover:bg-gray-50/80">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{order.phone || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-800">{formatGb(order)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-800">
                    {order.paymentReference || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {order.createdAt ? formatDatePart(order.createdAt) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {order.createdAt ? formatTimePart(order.createdAt) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-800">{formatNetwork(order.category)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusColors[order.deliveryStatus] || statusColors.pending}`}
                    >
                      {order.deliveryStatus || 'pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import api from '../api/client';
import { useOnlineStatus } from '../context/OnlineContext';
import { getOfflineAwareErrorMessage, OFFLINE_ACTION_MESSAGE } from '../utils/offline';
import { useToast } from '../context/ToastContext';
import { getPaymentReferencesFromCookie } from '../utils/orderHistoryCookie';
import { Loader2, RefreshCw } from 'lucide-react';

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

const STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  verification: 'Number verification',
  delivered: 'Delivered',
  failed: 'Failed',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
};

const formatStatusLabel = (value) => STATUS_LABELS[value] || 'Processing';

const deliveryBadgeClass = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-sky-100 text-sky-800',
  verification: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-slate-200 text-slate-700',
  cancelled: 'bg-gray-200 text-gray-700',
};

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async ({ silent = false } = {}) => {
      const refs = getPaymentReferencesFromCookie();
      if (!refs.length) {
        if (!cancelled) {
          setOrders([]);
          setLoading(false);
        }
        return;
      }

      if (!isOnline) {
        if (!silent && !cancelled) toast(OFFLINE_ACTION_MESSAGE, 'error');
        if (!cancelled) setLoading(false);
        return;
      }

      if (!cancelled) {
        if (silent) setRefreshing(true);
        else setLoading(true);
      }

      try {
        const { data } = await api.post('/orders/history/by-references', {
          paymentReferences: refs,
        }, { timeout: 90000 });
        if (!cancelled) setOrders(data.orders || []);
      } catch (err) {
        if (!silent && !cancelled) {
          toast(getOfflineAwareErrorMessage(err, 'Could not load order history.'), 'error');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    loadOrders();
    const timer = setInterval(() => loadOrders({ silent: true }), 60_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOnline, toast]);

  const handleRefresh = async () => {
    const refs = getPaymentReferencesFromCookie();
    if (!refs.length || !isOnline) return;
    setRefreshing(true);
    try {
      const { data } = await api.post('/orders/history/by-references', {
        paymentReferences: refs,
      }, { timeout: 90000 });
      setOrders(data.orders || []);
    } catch (err) {
      toast(getOfflineAwareErrorMessage(err, 'Could not refresh status.'), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="section-title">Order History</h1>
          <p className="section-subtitle">
            Delivery status updates from the network and shows here for orders on this device.
          </p>
        </div>
        {orders.length > 0 && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading || !isOnline}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh status
          </button>
        )}
      </div>

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
                <th className="px-4 py-3">Beneficiary</th>
                <th className="px-4 py-3">GB</th>
                <th className="px-4 py-3">Delivery status</th>
                <th className="px-4 py-3">Paystack reference</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Network</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <tr key={order.paymentReference || order.reference} className="hover:bg-gray-50/80">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">{order.phone || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-800">{formatGb(order)}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                        deliveryBadgeClass[order.deliveryStatus] || deliveryBadgeClass.processing
                      }`}
                    >
                      {formatStatusLabel(order.deliveryStatus)}
                    </span>
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

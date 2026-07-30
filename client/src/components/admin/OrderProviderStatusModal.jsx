import { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, X } from 'lucide-react';
import api from '../../api/client';
import { formatDate } from '../../utils/validation';

const providerStatusClass = {
  delivered: 'bg-emerald-100 text-emerald-800',
  processing: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  queued: 'bg-amber-100 text-amber-800',
  unknown: 'bg-slate-100 text-slate-700',
};

const formatProviderStatus = (value) => {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export default function OrderProviderStatusModal({ order, open, onClose, onSynced }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  const fetchStatus = useCallback(async () => {
    if (!order?._id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/admin/orders/${order._id}/sync-provider`);
      setStatus(data);
      if (data.synced) onSynced?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not fetch API status.');
    } finally {
      setLoading(false);
    }
  }, [order?._id, onSynced]);

  useEffect(() => {
    if (!open || !order) return undefined;
    fetchStatus();
    const interval = setInterval(fetchStatus, 15_000);
    return () => clearInterval(interval);
  }, [open, order, fetchStatus]);

  if (!open || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">API status</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-900">{order.reference}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">API reference</p>
              <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">
                {status?.apiReference || order.providerReference || order.reference}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Provider</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {status?.providerName || order.providerId || '—'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                providerStatusClass[status?.providerStatus] || providerStatusClass.unknown
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              API: {formatProviderStatus(status?.providerStatus)}
            </span>
            <span className="text-xs text-slate-500">
              Your site:{' '}
              <strong className="text-slate-800">
                {formatProviderStatus(status?.deliveryStatus || order.deliveryStatus)}
              </strong>
            </span>
            {status?.synced && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Synced to your orders
              </span>
            )}
          </div>

          {status?.message && <p className="text-sm text-slate-600">{status.message}</p>}
          {status?.queueReason && (
            <p className="text-sm text-amber-800">
              Queue reason: <span className="font-medium">{status.queueReason}</span>
            </p>
          )}

          {status?.checkedAt && (
            <p className="text-xs text-slate-500">Last checked: {formatDate(status.checkedAt)}</p>
          )}

          <p className="text-xs text-slate-500">
            Status refreshes every 15 seconds while this panel is open. When the API reports delivered or processing,
            your order status updates automatically.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={fetchStatus}
            disabled={loading}
            className="admin-api-btn inline-flex items-center gap-2 !px-3 !py-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Checking...' : 'Refresh now'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderProviderStatusButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--admin-gold,#f5c518)] text-[#111827] transition hover:bg-[#e6b800] disabled:cursor-not-allowed disabled:opacity-50"
      title="Check API status"
      aria-label="Check API status"
    >
      <Activity className="h-4 w-4" />
    </button>
  );
}


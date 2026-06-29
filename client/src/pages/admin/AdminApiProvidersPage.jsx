import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plug, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

const NETWORKS = [
  { key: 'MTN', label: 'MTN' },
  { key: 'Telecel', label: 'Telecel' },
  { key: 'AirtelTigo', label: 'AirtelTigo' },
  { key: 'AirtelTigo Big Time', label: 'AirtelTigo Big Time' },
  { key: 'MTN AFA', label: 'AFA Registration', hint: 'MTN farmer registration via Datamax', highlight: true },
];

const PROVIDER_OPTIONS = [
  { value: 'default', label: 'Use default' },
  { value: 'smart_data_hub', label: 'Smart Data Hub' },
  { value: 'datamax', label: 'Datamax' },
  { value: 'disabled', label: 'Off' },
];

const providerLabel = (value) => PROVIDER_OPTIONS.find((opt) => opt.value === value)?.label || value;

const DEFAULT_PROVIDER_OPTIONS = [
  { value: 'smart_data_hub', label: 'Smart Data Hub' },
  { value: 'datamax', label: 'Datamax' },
];

export default function AdminApiProvidersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [keys, setKeys] = useState({ smart_data_hub: '', smart_data_hub_secret: '', datamax: '' });
  const [balance, setBalance] = useState(null);
  const [balanceProvider, setBalanceProvider] = useState('');

  const { data: config, isLoading, isError } = useQuery({
    queryKey: ['admin-api-providers'],
    queryFn: () => api.get('/admin/api-providers').then((r) => r.data.config),
  });

  const { data: queuedData } = useQuery({
    queryKey: ['admin-api-queued'],
    queryFn: () => api.get('/admin/api-providers/queued').then((r) => r.data.orders),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (config) {
      setForm({
        forwardingEnabled: config.forwardingEnabled,
        defaultProvider: config.defaultProvider,
        networkProviders: { ...config.networkProviders },
        fulfillmentWebhookUrl: config.fulfillmentWebhookUrl || '',
        providers: config.providers,
      });
    }
  }, [config]);

  const saveConfig = useMutation({
    mutationFn: (payload) => api.put('/admin/api-providers', payload).then((r) => r.data.config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-api-providers'] });
      setKeys({ smart_data_hub: '', smart_data_hub_secret: '', datamax: '' });
      toast('API routing saved.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Save failed.', 'error'),
  });

  const testProvider = useMutation({
    mutationFn: (providerId) => api.post(`/admin/api-providers/test/${providerId}`).then((r) => r.data),
    onSuccess: (data) => toast(data.message || (data.success ? 'Connection OK.' : 'Test failed.'), data.success ? 'success' : 'error'),
    onError: (err) => toast(err.response?.data?.message || 'Test failed.', 'error'),
  });

  const fetchDatamaxBalance = useMutation({
    mutationFn: () => api.get('/admin/api-providers/datamax/balance').then((r) => r.data),
    onSuccess: (data) => {
      setBalance(data);
      setBalanceProvider('datamax');
      toast(`Datamax balance: ${data.balance ?? '—'} ${data.currency || 'GHS'}`, 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Could not fetch balance.', 'error'),
  });

  const fetchSmartDataHubBalance = useMutation({
    mutationFn: () => api.get('/admin/api-providers/smart-data-hub/balance').then((r) => r.data),
    onSuccess: (data) => {
      setBalance(data);
      setBalanceProvider('smart_data_hub');
      toast(`Smart Data Hub balance: ${data.balance ?? '—'} ${data.currency || 'GHS'}`, 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Could not fetch balance.', 'error'),
  });

  const retryQueued = useMutation({
    mutationFn: () => api.post('/admin/api-providers/retry-queued').then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-api-queued'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      const msg =
        data.delivered > 0
          ? `${data.delivered} order(s) delivered. ${data.stillQueued || 0} still waiting.`
          : `Retried ${data.retried} order(s). ${data.stillQueued || 0} still waiting for funds.`;
      toast(msg, data.delivered > 0 ? 'success' : 'error');
    },
    onError: (err) => toast(err.response?.data?.message || 'Retry failed.', 'error'),
  });

  if (isLoading || !form) return <div className="admin-panel h-48 animate-pulse bg-slate-100" />;
  if (isError) return <div className="admin-panel text-sm text-red-600">Could not load API settings.</div>;

  const handleSave = () => {
    const payload = {
      forwardingEnabled: form.forwardingEnabled,
      defaultProvider: form.defaultProvider,
      networkProviders: form.networkProviders,
      fulfillmentWebhookUrl: form.fulfillmentWebhookUrl,
      credentials: {},
    };

    if (keys.smart_data_hub) {
      payload.credentials.smart_data_hub = { apiKey: keys.smart_data_hub };
    }
    if (keys.smart_data_hub_secret) {
      payload.credentials.smart_data_hub = {
        ...(payload.credentials.smart_data_hub || {}),
        apiSecret: keys.smart_data_hub_secret,
      };
    }
    if (keys.datamax) {
      payload.credentials.datamax = { apiKey: keys.datamax };
    }

    saveConfig.mutate(payload);
  };

  const queuedCount = queuedData?.length || 0;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="API Providers"
        subtitle="Route data bundles and AFA registration through Smart Data Hub or Datamax. Low-balance orders queue automatically and retry without duplicates."
      />

      <div className="admin-panel space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                form.forwardingEnabled ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
              }`}
            >
              API forwarding: {form.forwardingEnabled ? 'ON' : 'OFF'}
            </span>
            <p className="text-sm text-slate-600">Master switch — turns off all networks at once. Use &quot;Off&quot; per network below to disable one only.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={form.forwardingEnabled}
              onChange={(e) => setForm({ ...form, forwardingEnabled: e.target.checked })}
            />
            Enable forwarding
          </label>
        </div>

        <div className="max-w-md">
          <label className="mb-1.5 block text-sm font-semibold text-slate-800">Default provider</label>
          <select
            className="input-field"
            value={form.defaultProvider}
            onChange={(e) => setForm({ ...form, defaultProvider: e.target.value })}
          >
            {DEFAULT_PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Used for networks set to &quot;Use default&quot;</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {NETWORKS.map((network) => {
            const selected = form.networkProviders[network.key] || 'default';
            const isOff = selected === 'disabled';

            return (
            <div
              key={network.key}
              className={`rounded-xl border p-4 ${
                isOff
                  ? 'border-red-300 bg-red-50/60'
                  : network.highlight
                    ? 'border-amber-300 bg-amber-50/50'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-slate-900">{network.label}</p>
                {isOff && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                    API off
                  </span>
                )}
              </div>
              {network.hint && <p className="mt-1 text-xs text-amber-800">{network.hint}</p>}
              <select
                className={`input-field mt-3 ${isOff ? 'border-red-300 bg-white' : ''}`}
                value={selected}
                onChange={(e) =>
                  setForm({
                    ...form,
                    networkProviders: { ...form.networkProviders, [network.key]: e.target.value },
                  })
                }
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">
                {isOff ? 'Orders queue until you turn this network back on.' : `Routing: ${providerLabel(selected)}`}
              </p>
            </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => testProvider.mutate('smart_data_hub')}
            disabled={testProvider.isPending}
            className="admin-api-btn"
          >
            Test Smart Data Hub
          </button>
          <button
            type="button"
            onClick={() => testProvider.mutate('datamax')}
            disabled={testProvider.isPending}
            className="admin-api-btn"
          >
            Test Datamax
          </button>
          <button
            type="button"
            onClick={() => fetchSmartDataHubBalance.mutate()}
            disabled={fetchSmartDataHubBalance.isPending}
            className="admin-api-btn"
          >
            Smart Data Hub balance
          </button>
          <button
            type="button"
            onClick={() => fetchDatamaxBalance.mutate()}
            disabled={fetchDatamaxBalance.isPending}
            className="admin-api-btn"
          >
            Datamax balance
          </button>
          <button
            type="button"
            onClick={() => retryQueued.mutate()}
            disabled={retryQueued.isPending || queuedCount === 0}
            className="admin-api-btn inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${retryQueued.isPending ? 'animate-spin' : ''}`} />
            Retry queued orders {queuedCount > 0 ? `(${queuedCount})` : ''}
          </button>
        </div>

        {balance?.balance != null && (
          <p className="text-sm font-semibold text-emerald-700">
            {balanceProvider === 'smart_data_hub' ? 'Smart Data Hub' : 'Datamax'} wallet: {balance.balance}{' '}
            {balance.currency || 'GHS'}
          </p>
        )}

        <div className="grid gap-4 border-t border-slate-200 pt-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <Plug className="h-4 w-4" />
              Smart Data Hub credentials
            </h3>
            <p className="text-xs text-slate-500">
              {form.providers?.smart_data_hub?.apiUrl}{' '}
              {form.providers?.smart_data_hub?.configured ? '(configured)' : '(not configured)'}
            </p>
            <input
              className="input-field"
              type="password"
              placeholder={
                form.providers?.smart_data_hub?.configured
                  ? `Current key: ${form.providers.smart_data_hub.apiKeyHint}`
                  : 'Paste API key'
              }
              value={keys.smart_data_hub}
              onChange={(e) => setKeys({ ...keys, smart_data_hub: e.target.value })}
            />
            <input
              className="input-field"
              type="password"
              placeholder={
                form.providers?.smart_data_hub?.configured
                  ? `Current secret: ${form.providers.smart_data_hub.apiSecretHint}`
                  : 'Paste API secret (HMAC)'
              }
              value={keys.smart_data_hub_secret}
              onChange={(e) => setKeys({ ...keys, smart_data_hub_secret: e.target.value })}
            />
            <p className="text-xs text-slate-500">
              HMAC auth: whitelist your server IP/domain in Smart Data Hub → API Management.
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-bold text-slate-900">
              <Plug className="h-4 w-4" />
              Datamax credentials
            </h3>
            <p className="text-xs text-slate-500">
              {form.providers?.datamax?.apiUrl}{' '}
              {form.providers?.datamax?.configured ? '(configured)' : '(not configured)'}
            </p>
            <input
              className="input-field"
              type="password"
              placeholder={
                form.providers?.datamax?.configured
                  ? `Current key: ${form.providers.datamax.apiKeyHint}`
                  : 'Paste API key'
              }
              value={keys.datamax}
              onChange={(e) => setKeys({ ...keys, datamax: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-800">Fulfillment webhook URL (optional)</label>
          <input
            className="input-field"
            placeholder="https://your-backend.com/api/webhooks/fulfillment"
            value={form.fulfillmentWebhookUrl}
            onChange={(e) => setForm({ ...form, fulfillmentWebhookUrl: e.target.value })}
          />
        </div>

        <button type="button" onClick={handleSave} disabled={saveConfig.isPending} className="btn-primary">
          {saveConfig.isPending ? 'Saving...' : 'Save API routing'}
        </button>

        <p className="text-xs leading-relaxed text-slate-500">
          Smart Data Hub: {form.providers?.smart_data_hub?.apiUrl} — HMAC auth, GET /test, POST /orders/create
          <br />
          Datamax data API: {form.providers?.datamax?.apiUrl} — place_order, check_balance, order_status
          <br />
          Datamax AFA API: https://datamax.site/wp-json/afa/v1/register
          <br />
          Auth header: X-API-KEY (data bundles) · api_key in body (AFA)
          {form.fulfillmentWebhookUrl && (
            <>
              <br />
              Webhook: {form.fulfillmentWebhookUrl}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

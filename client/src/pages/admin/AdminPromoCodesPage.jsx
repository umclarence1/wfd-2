import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, X } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import PromoCheckoutToggle from '../../components/admin/PromoCheckoutToggle';

const PACKAGE_OPTIONS = [
  { value: 'all', label: 'All products' },
  { value: 'MTN', label: 'MTN' },
  { value: 'Telecel', label: 'Telecel' },
  { value: 'AirtelTigo', label: 'AirtelTigo' },
  { value: 'AirtelTigo Big Time', label: 'AirtelTigo Big Time' },
  { value: 'MTN AFA', label: 'MTN AFA' },
  { value: 'BECE Checker', label: 'BECE Checker' },
  { value: 'WASSCE Checker', label: 'WASSCE Checker' },
];

const emptyPromo = {
  quantity: 10,
  packageScope: 'all',
  discountValue: 5,
  expiryDate: '',
  usageLimit: '',
  description: '',
};

const maskPromoCode = (code) => {
  const value = String(code || '').toUpperCase();
  if (value.length <= 4) return `****${value}`;
  return `****${value.slice(-4)}`;
};

const formatPackageScope = (promo) => {
  const categories = promo.productCategories || [];
  if (categories.length === 0 && (!promo.productIds || promo.productIds.length === 0)) {
    return 'All products';
  }
  if (categories.length > 0) return categories.join(', ');
  return 'Selected products';
};

const formatDiscount = (promo) => {
  if (promo.discountType === 'free') return 'Free';
  if (promo.discountType === 'percentage') return `${promo.discountValue}%`;
  return `GHS ${Number(promo.discountValue || 0).toFixed(2)}`;
};

const formatUsed = (promo) => (promo.usageCount > 0 ? String(promo.usageCount) : '—');

const getApiErrorMessage = (err, fallback) => {
  const status = err.response?.status;
  const message = err.response?.data?.message;

  if (status === 503) {
    return message || 'Server database is not connected. Update MONGODB_URI on the server and redeploy.';
  }
  if (status === 403) {
    return message || 'Session expired. Log out and sign in again.';
  }
  if (status === 404) {
    return 'Promo API not found. Restart the backend server (npm run dev) and try again.';
  }
  return message || fallback;
};

async function createPromoBatch(payload) {
  try {
    const { data } = await api.post('/admin/promos/bulk', payload);
    return data;
  } catch (err) {
    if (err.response?.status !== 404) throw err;

    const count = Math.min(Math.max(Number(payload.count) || 1, 1), 100);
    const { count: _omit, ...settings } = payload;
    const promos = [];

    for (let i = 0; i < count; i += 1) {
      const { data } = await api.post('/admin/promos', settings);
      promos.push(data.promo);
    }

    return { promos, count: promos.length };
  }
}

const copyText = async (text, toast, message) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(message, 'success');
  } catch {
    toast('Could not copy to clipboard.', 'error');
  }
};

export default function AdminPromoCodesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyPromo);
  const [showForm, setShowForm] = useState(false);
  const [generatedBatch, setGeneratedBatch] = useState([]);

  const { data: promos = [], isLoading, isError } = useQuery({
    queryKey: ['admin-promos'],
    queryFn: () => api.get('/admin/promos').then((r) => r.data.promos),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const generatePromos = useMutation({
    mutationFn: (payload) => createPromoBatch(payload),
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-promos'] });
      const codes = (data.promos || []).map((p) => p.code);
      setGeneratedBatch(data.promos || []);
      setShowForm(false);

      if (codes.length === 1) {
        await copyText(codes[0], toast, `Code ${codes[0]} copied to clipboard.`);
      } else if (codes.length > 1) {
        await copyText(codes.join('\n'), toast, `${codes.length} codes copied to clipboard.`);
      }
    },
    onError: (err) => toast(getApiErrorMessage(err, 'Could not generate promos.'), 'error'),
  });

  const updatePromo = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/admin/promos/${id}`, payload).then((r) => r.data.promo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promos'] });
      toast('Promo updated.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Update failed.', 'error'),
  });

  const buildPayload = () => ({
    count: Number(form.quantity) || 1,
    description: form.description,
    discountType: 'fixed',
    discountValue: Number(form.discountValue),
    expiryDate: new Date(form.expiryDate).toISOString(),
    usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
    productCategories: form.packageScope === 'all' ? [] : [form.packageScope],
    isActive: true,
  });

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!form.expiryDate) {
      toast('Expiry date is required.', 'error');
      return;
    }
    if (!form.discountValue || Number(form.discountValue) <= 0) {
      toast('Enter a valid discount amount.', 'error');
      return;
    }
    const quantity = Number(form.quantity);
    if (!quantity || quantity < 1 || quantity > 100) {
      toast('Quantity must be between 1 and 100.', 'error');
      return;
    }

    generatePromos.mutate(buildPayload());
  };

  const allGeneratedCodes = generatedBatch.map((p) => p.code).join('\n');

  if (isLoading) return <div className="admin-panel h-48 animate-pulse bg-slate-100" />;
  if (isError) {
    return (
      <div className="admin-panel space-y-2 text-sm text-red-700">
        <p>Could not load promo codes.</p>
        <p className="text-slate-600">If you are on the live site, the server database may be offline. Check MongoDB Atlas and Vercel env vars.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader
          title="Promo Codes"
          subtitle="Generate one or many discount codes at once. Full codes are shown after generation."
        />
        <div className="flex flex-wrap items-center gap-2">
          <PromoCheckoutToggle compact />
          <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary">
            {showForm ? 'Cancel' : 'Generate Promo Codes'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleGenerate} className="admin-panel grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">How many codes?</label>
            <input
              className="input-field"
              type="number"
              min="1"
              max="100"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">Generate 1–100 codes at once</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Package</label>
            <select
              className="input-field"
              value={form.packageScope}
              onChange={(e) => setForm({ ...form, packageScope: e.target.value })}
            >
              {PACKAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Discount (GHS)</label>
            <input
              className="input-field"
              type="number"
              min="0.01"
              step="0.01"
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Expiry Date</label>
            <input
              className="input-field"
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Usage Limit (optional)</label>
            <input
              className="input-field"
              type="number"
              min="1"
              placeholder="Unlimited"
              value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Note (optional)</label>
            <input
              className="input-field"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Internal note"
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={generatePromos.isPending} className="btn-primary">
              {generatePromos.isPending
                ? 'Generating...'
                : `Generate ${Number(form.quantity) > 1 ? `${form.quantity} Codes` : 'Code'}`}
            </button>
          </div>
        </form>
      )}

      {generatedBatch.length > 0 && (
        <div className="admin-panel space-y-4 border-2 border-emerald-200 bg-emerald-50/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {generatedBatch.length} code{generatedBatch.length === 1 ? '' : 's'} generated
              </h3>
              <p className="text-sm text-slate-600">Full codes below — copy one or all.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText(allGeneratedCodes, toast, 'All codes copied.')}
                className="btn-primary inline-flex items-center gap-2 !py-2 text-sm"
              >
                <Copy className="h-4 w-4" />
                Copy all
              </button>
              <button
                type="button"
                onClick={() => setGeneratedBatch([])}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Dismiss
              </button>
            </div>
          </div>

          <textarea
            readOnly
            className="input-field min-h-[120px] font-mono text-sm"
            value={allGeneratedCodes}
            onFocus={(e) => e.target.select()}
          />

          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {generatedBatch.map((promo) => (
              <div
                key={promo._id}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 last:border-0"
              >
                <span className="font-mono text-sm font-bold tracking-wide text-slate-900">{promo.code}</span>
                <button
                  type="button"
                  onClick={() => copyText(promo.code, toast, `Copied ${promo.code}`)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="admin-panel overflow-x-auto !p-0 sm:!p-0">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-bold text-slate-900">All codes</h2>
            <span className="text-sm text-slate-500">{promos.length} shown</span>
          </div>
        </div>

        <table className="promo-codes-table w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="px-5 py-3 text-xs font-bold text-slate-800 sm:px-6">Code</th>
              <th className="px-5 py-3 text-xs font-bold text-slate-800 sm:px-6">Package</th>
              <th className="px-5 py-3 text-xs font-bold text-slate-800 sm:px-6">Discount</th>
              <th className="px-5 py-3 text-xs font-bold text-slate-800 sm:px-6">Status</th>
              <th className="px-5 py-3 text-xs font-bold text-slate-800 sm:px-6">Used</th>
              <th className="px-5 py-3 text-xs font-bold text-slate-800 sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {promos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-500 sm:px-6">
                  No promo codes yet. Click &quot;Generate Promo Codes&quot; to create some.
                </td>
              </tr>
            ) : (
              promos.map((promo) => (
                <tr key={promo._id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3.5 font-mono text-slate-800 sm:px-6">
                    <button
                      type="button"
                      title="Click to copy full code"
                      className="hover:text-blue-700"
                      onClick={() => copyText(promo.code, toast, `Copied ${promo.code}`)}
                    >
                      {maskPromoCode(promo.code)}
                    </button>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 sm:px-6">{formatPackageScope(promo)}</td>
                  <td className="px-5 py-3.5 text-slate-700 sm:px-6">{formatDiscount(promo)}</td>
                  <td className="px-5 py-3.5 sm:px-6">
                    <span className={promo.isActive ? 'font-medium text-emerald-600' : 'font-medium text-slate-500'}>
                      {promo.isActive ? 'active' : 'disabled'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 sm:px-6">{formatUsed(promo)}</td>
                  <td className="px-5 py-3.5 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(promo.code, toast, `Copied ${promo.code}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                      {promo.isActive ? (
                        <button
                          type="button"
                          onClick={() => updatePromo.mutate({ id: promo._id, payload: { isActive: false } })}
                          className="admin-api-btn !px-4 !py-1 text-xs"
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updatePromo.mutate({ id: promo._id, payload: { isActive: true } })}
                          className="rounded-lg border border-slate-300 bg-white px-4 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Enable
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Unlock } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import PackagePriceInput from '../../components/admin/PackagePriceInput';

const PACKAGE_CATEGORIES = [
  'MTN',
  'Telecel',
  'AirtelTigo',
  'AirtelTigo Big Time',
  'MTN AFA',
  'BECE Checker',
  'WASSCE Checker',
];

const CATEGORY_CONFIG = {
  MTN: { serviceType: 'data_bundle', label: 'Data bundle' },
  Telecel: { serviceType: 'data_bundle', label: 'Data bundle' },
  AirtelTigo: { serviceType: 'data_bundle', label: 'Data bundle' },
  'AirtelTigo Big Time': { serviceType: 'data_bundle', label: 'Data bundle' },
  'MTN AFA': { serviceType: 'afa_registration', label: 'AFA registration', afaType: 'new' },
  'BECE Checker': { serviceType: 'result_checker', label: 'Result checker', checkerType: 'BECE' },
  'WASSCE Checker': { serviceType: 'result_checker', label: 'Result checker', checkerType: 'WASSCE' },
};

const emptyForm = {
  category: 'MTN',
  dataAmount: '',
  price: '',
  name: '',
};

function isPackageSelling(pkg) {
  return pkg.adminPaused !== true && pkg.isAvailable !== false;
}

function buildPackageName(category, dataAmount) {
  const amount = dataAmount.trim();
  if (!amount) {
    if (category === 'MTN AFA') return 'MTN AFA Registration';
    if (category === 'BECE Checker') return 'BECE Result Checker';
    if (category === 'WASSCE Checker') return 'WASSCE Result Checker';
    return category;
  }
  return `${category} ${amount}`;
}

export default function AdminPackagesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-packages'],
    queryFn: () => api.get('/admin/packages').then((r) => r.data.packages),
    staleTime: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const packages = Array.isArray(data) ? data : [];

  const isDataBundle = CATEGORY_CONFIG[form.category]?.serviceType === 'data_bundle';

  const suggestedName = useMemo(
    () => buildPackageName(form.category, form.dataAmount),
    [form.category, form.dataAmount]
  );

  const updatePackage = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/admin/packages/${id}`, payload).then((r) => r.data.package),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['checker-pricing'] });
      toast('Package updated.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Update failed.', 'error'),
  });

  const createPackage = useMutation({
    mutationFn: (payload) => api.post('/admin/packages', payload).then((r) => r.data.package),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      setForm(emptyForm);
      setShowForm(false);
      toast('Package added to the website.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Could not add package.', 'error'),
  });

  const toggleAvailability = useMutation({
    mutationFn: ({ id, isAvailable }) =>
      api.patch(`/admin/packages/${id}/availability`, { isAvailable }).then((r) => r.data.package),
    onSuccess: (pkg) => {
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast(
        pkg.adminPaused ? 'Sales paused for this package.' : 'Sales resumed for this package.',
        'success'
      );
    },
    onError: (err) => toast(err.response?.data?.message || 'Update failed.', 'error'),
  });

  const toggleCategoryAvailability = useMutation({
    mutationFn: ({ category, isAvailable }) =>
      api
        .patch(`/admin/packages/category/${encodeURIComponent(category)}/availability`, { isAvailable })
        .then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast(
        `${data.category}: ${data.modifiedCount} package(s) ${data.isAvailable ? 'back on sale' : 'sales paused'}.`,
        'success'
      );
    },
    onError: (err) => toast(err.response?.data?.message || 'Bulk update failed.', 'error'),
  });

  const deletePackage = useMutation({
    mutationFn: (id) => api.delete(`/admin/packages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast('Package deleted.', 'success');
    },
    onError: (err) => toast(err.response?.data?.message || 'Could not delete package.', 'error'),
  });

  const handleCreate = (e) => {
    e.preventDefault();
    const price = Number(form.price);
    if (Number.isNaN(price) || price < 0) {
      toast('Enter a valid price.', 'error');
      return;
    }
    if (isDataBundle && !form.dataAmount.trim()) {
      toast('Enter the data amount (e.g. 1GB).', 'error');
      return;
    }

    const config = CATEGORY_CONFIG[form.category];

    const payload = {
      category: form.category,
      name: (form.name.trim() || suggestedName).trim(),
      price,
      serviceType: config.serviceType,
      isActive: true,
      isAvailable: true,
      ...(isDataBundle && { dataAmount: form.dataAmount.trim().toUpperCase() }),
      ...(config.afaType && { afaType: config.afaType }),
      ...(config.checkerType && { checkerType: config.checkerType }),
    };

    createPackage.mutate(payload);
  };

  if (isLoading) return <div className="admin-panel h-48 animate-pulse bg-slate-100" />;
  if (isError) return <div className="admin-panel text-sm text-red-600">Could not load packages.</div>;

  const grouped = packages.reduce((acc, pkg) => {
    if (!acc[pkg.category]) acc[pkg.category] = [];
    acc[pkg.category].push(pkg);
    return acc;
  }, {});

  Object.keys(grouped).forEach((category) => {
    grouped[category].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader title="Packages" subtitle="Manage package prices and availability." />
        <button type="button" onClick={() => setShowForm((v) => !v)} className="btn-primary inline-flex">
          <Plus className="h-4 w-4" />
          {showForm ? 'Cancel' : 'Add Package'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="admin-panel space-y-4">
          <h3 className="font-bold text-slate-900">New Package</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Network / Category</label>
              <select
                className="input-field"
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...emptyForm,
                    category: e.target.value,
                    name: '',
                  })
                }
              >
                {PACKAGE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {isDataBundle ? (
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Data Amount</label>
                <input
                  className="input-field uppercase"
                  placeholder="e.g. 1GB"
                  value={form.dataAmount}
                  onChange={(e) => setForm({ ...form, dataAmount: e.target.value, name: '' })}
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Type</label>
                <input className="input-field bg-slate-50" readOnly value={CATEGORY_CONFIG[form.category]?.label} />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Price (GH₵)</label>
              <input
                className="input-field"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 5.00"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Display Name</label>
              <input
                className="input-field"
                placeholder={suggestedName}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">Leave blank to use: {suggestedName}</p>
            </div>
          </div>

          <button type="submit" disabled={createPackage.isPending} className="btn-primary">
            {createPackage.isPending ? 'Adding...' : 'Add to Website'}
          </button>
        </form>
      )}

      {Object.entries(grouped).map(([category, items]) => {
        const sellingCount = items.filter(isPackageSelling).length;
        const allSelling = sellingCount === items.length;
        const noneSelling = sellingCount === 0;

        return (
        <div key={category} className="admin-panel overflow-x-auto">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{category}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {sellingCount} of {items.length} currently on sale
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={toggleCategoryAvailability.isPending || allSelling}
                onClick={() => {
                  if (
                    window.confirm(
                      `Resume sales for all ${category} packages? Customers will be able to buy them again.`
                    )
                  ) {
                    toggleCategoryAvailability.mutate({ category, isAvailable: true });
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Unlock className="h-3.5 w-3.5" />
                Resume all sales
              </button>
              <button
                type="button"
                disabled={toggleCategoryAvailability.isPending || noneSelling}
                onClick={() => {
                  if (
                    window.confirm(
                      `Stop all ${category} sales? No one can buy these packages until you resume them.`
                    )
                  ) {
                    toggleCategoryAvailability.mutate({ category, isAvailable: false });
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Lock className="h-3.5 w-3.5" />
                Stop all sales
              </button>
            </div>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Data</th>
                <th>Price</th>
                <th>Active</th>
                <th>Sales</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.filter(Boolean).map((pkg) => (
                <tr key={pkg._id}>
                  <td className="font-semibold text-slate-900">{pkg.name}</td>
                  <td>{pkg.dataAmount || '—'}</td>
                  <td>
                    <PackagePriceInput
                      pkg={pkg}
                      value={pkg.price}
                      isSaving={updatePackage.isPending}
                      onSave={(price) => updatePackage.mutate({ id: pkg._id, payload: { price } })}
                    />
                  </td>
                  <td>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked={pkg.isActive !== false}
                        onChange={(e) =>
                          updatePackage.mutate({ id: pkg._id, payload: { isActive: e.target.checked } })
                        }
                      />
                      <span>{pkg.isActive !== false ? 'Yes' : 'No'}</span>
                    </label>
                  </td>
                  <td>
                    {pkg.adminPaused ? (
                      <div className="space-y-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">
                          <Lock className="h-3 w-3" />
                          Sales paused
                        </span>
                        <button
                          type="button"
                          disabled={toggleAvailability.isPending}
                          onClick={() =>
                            toggleAvailability.mutate({ id: pkg._id, isAvailable: true })
                          }
                          className="block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Resume selling
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          On sale
                        </span>
                        <button
                          type="button"
                          disabled={toggleAvailability.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Stop selling "${pkg.name}"? It stays off until you click Resume selling.`
                              )
                            ) {
                              toggleAvailability.mutate({ id: pkg._id, isAvailable: false });
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Lock className="h-3 w-3" />
                          Stop selling
                        </button>
                      </div>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={deletePackage.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete "${pkg.name}"? This removes it from the website. Past orders are not affected.`
                          )
                        ) {
                          deletePackage.mutate(pkg._id);
                        }
                      }}
                      className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        );
      })}
    </div>
  );
}

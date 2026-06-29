import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '../../api/client';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { formatCurrency, formatDate } from '../../utils/validation';

export default function AdminSearchPage() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isFetching, isError } = useQuery({
    queryKey: ['admin-search', submitted],
    queryFn: async () => {
      if (!submitted.trim()) return null;

      const q = submitted.trim();
      const [ordersRes, packagesRes, promosRes, usersRes] = await Promise.all([
        api.get('/admin/orders', { params: { search: q, limit: 10 } }),
        api.get('/admin/packages'),
        api.get('/admin/promos'),
        api.get('/admin/users', { params: { search: q, limit: 10 } }),
      ]);

      const packages = (packagesRes.data.packages || []).filter(
        (p) =>
          p.name?.toLowerCase().includes(q.toLowerCase()) ||
          p.category?.toLowerCase().includes(q.toLowerCase()) ||
          p.dataAmount?.toLowerCase().includes(q.toLowerCase())
      );

      const promos = (promosRes.data.promos || []).filter((p) =>
        p.code?.toLowerCase().includes(q.toLowerCase())
      );

      return {
        orders: ordersRes.data.orders || [],
        packages: packages.slice(0, 10),
        promos: promos.slice(0, 10),
        users: usersRes.data.users || [],
      };
    },
    enabled: Boolean(submitted.trim()),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(query.trim());
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Search" subtitle="Find orders, packages, promo codes, and customers quickly." />

      <form onSubmit={handleSubmit} className="admin-panel">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input-field !pl-10"
              placeholder="Search orders, packages, promo codes, emails..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary shrink-0">
            Search
          </button>
        </div>
      </form>

      {submitted && isFetching && <div className="admin-panel h-32 animate-pulse bg-slate-100" />}
      {submitted && isError && <div className="admin-panel text-sm text-red-600">Search failed.</div>}

      {data && (
        <div className="space-y-6">
          <SearchSection title="Orders" empty="No matching orders." items={data.orders}>
            {(order) => (
              <div key={order._id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{order.reference}</p>
                <p className="text-sm text-slate-600">{order.packageName || order.package?.name} · {formatCurrency(order.totalAmount)}</p>
                <p className="text-xs text-slate-500">{order.email} · {order.phone} · {formatDate(order.createdAt)}</p>
              </div>
            )}
          </SearchSection>

          <SearchSection title="Packages" empty="No matching packages." items={data.packages}>
            {(pkg) => (
              <div key={pkg._id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{pkg.name}</p>
                <p className="text-sm text-slate-600">{pkg.category} · {pkg.dataAmount || '—'} · {formatCurrency(pkg.price)}</p>
              </div>
            )}
          </SearchSection>

          <SearchSection title="Promo Codes" empty="No matching promo codes." items={data.promos}>
            {(promo) => (
              <div key={promo._id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{promo.code}</p>
                <p className="text-sm text-slate-600">{promo.discountType} · {promo.isActive ? 'Active' : 'Inactive'}</p>
              </div>
            )}
          </SearchSection>

          <SearchSection title="Customers" empty="No matching customers." items={data.users}>
            {(user) => (
              <div key={user._id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">{user.name}</p>
                <p className="text-sm text-slate-600">{user.email}</p>
              </div>
            )}
          </SearchSection>
        </div>
      )}
    </div>
  );
}

function SearchSection({ title, empty, items, children }) {
  return (
    <div className="admin-panel">
      <h3 className="mb-4 font-bold text-slate-900">{title}</h3>
      {items?.length ? <div className="space-y-2">{items.map(children)}</div> : <p className="text-sm text-slate-500">{empty}</p>}
    </div>
  );
}

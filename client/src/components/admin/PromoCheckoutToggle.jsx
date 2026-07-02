import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tag, Eye, EyeOff } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';

export default function PromoCheckoutToggle({ compact = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data.settings),
    staleTime: 10_000,
  });

  const toggle = useMutation({
    mutationFn: (enabled) =>
      api.patch('/admin/settings/promo-checkout', { enabled }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      if (data.promoCheckoutEnabled) {
        toast('Promo code field is now visible on the website.', 'success');
      } else {
        toast('Promo code field hidden from the website.', 'success');
      }
    },
    onError: (err) => toast(err.response?.data?.message || 'Could not update promo visibility.', 'error'),
  });

  const isLive = settings?.promoCheckoutEnabled === true;
  const pending = toggle.isPending;

  if (isLoading) {
    return compact ? null : <div className="admin-panel h-24 animate-pulse bg-slate-100" />;
  }

  if (compact) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => toggle.mutate(!isLive)}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
          isLive
            ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600'
            : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
        }`}
      >
        {isLive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        {pending ? 'Updating...' : isLive ? 'Hide promo field on site' : 'Show promo field on site'}
      </button>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border p-5 shadow-sm sm:p-6 ${
        isLive
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              isLive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Tag className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-slate-900">Promo code on checkout</h3>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Turn this on before a promo run so customers see the promo code box at checkout. Turn it off when
              you are done.
            </p>
            <p className={`mt-2 text-sm font-semibold ${isLive ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isLive ? 'Live — promo field is visible on the website' : 'Hidden — customers cannot enter a promo code'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={() => toggle.mutate(!isLive)}
          className={`shrink-0 rounded-xl px-5 py-3 text-sm font-bold transition-all disabled:opacity-60 ${
            isLive
              ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600'
              : 'bg-emerald-600 text-white shadow-md hover:bg-emerald-700'
          }`}
        >
          {pending ? 'Updating...' : isLive ? 'Hide from website' : 'Show on website'}
        </button>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Globe } from 'lucide-react';
import api from '../../api/client';

export const DATA_PLANS = [
  { id: 'mtn', name: 'MTN', category: 'MTN', link: '/services/data/mtn', image: '/images/networks/mtn.jpg' },
  { id: 'telecel', name: 'Telecel', category: 'Telecel', link: '/services/data/telecel', image: '/images/networks/telecel.jpg' },
  { id: 'airteltigo', name: 'AirtelTigo', category: 'AirtelTigo', link: '/services/data/airteltigo', image: '/images/networks/airteltigo.jpg' },
  { id: 'afa', name: 'MTN AFA', category: 'MTN AFA', link: '/services/afa', image: '/images/networks/afa.jpg' },
  {
    id: 'waec',
    name: 'Results Checkers',
    category: 'WAEC Checkers',
    link: '/services/checkers',
    image: '/images/networks/waec.jpg',
    availabilityCategories: ['BECE Checker', 'WASSCE Checker'],
  },
  {
    id: 'web-dev',
    name: 'Need a professional website for your business?',
    link: '/services/web-development',
    alwaysAvailable: true,
    isWebDev: true,
  },
];

function DataPlanCard({ plan, isAvailable }) {
  if (plan.isWebDev) {
    return (
      <Link to={plan.link} className="interactive-card group flex flex-col">
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-blue-600 to-blue-800 transition-all duration-500 group-hover:from-blue-500 group-hover:to-blue-700">
          <div className="flex h-full flex-col items-center justify-center p-5 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-white ring-1 ring-white/25 transition-transform duration-300 group-hover:scale-110 sm:h-16 sm:w-16">
              <Globe className="h-7 w-7 sm:h-8 sm:w-8" />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-blue-100">Web Design</p>
          </div>
        </div>
        <p className="border-t border-gray-100 px-3 py-3 text-center text-xs font-bold leading-snug text-gray-900 transition-colors duration-300 group-hover:bg-blue-50 group-hover:text-blue-700 sm:py-4 sm:text-sm">
          {plan.name}
        </p>
      </Link>
    );
  }

  const imageBlock = (
    <div className="relative aspect-square overflow-hidden bg-white">
      <img
        src={plan.image}
        alt={plan.name}
        className={`h-full w-full transition-transform duration-500 ease-out group-hover:scale-105 ${
          plan.id === 'waec' ? 'object-contain p-3 sm:p-5' : 'object-cover'
        }`}
        loading="lazy"
      />
    </div>
  );

  const label = (
    <p className="border-t border-gray-100 py-3 text-center text-sm font-bold text-gray-900 transition-colors duration-300 group-hover:bg-blue-50 group-hover:text-blue-700 sm:py-4 sm:text-base">
      {plan.name}
    </p>
  );

  if (!isAvailable) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 opacity-70">
        {imageBlock}
        <p className="border-t border-gray-100 py-3 text-center text-sm font-bold text-gray-500">{plan.name}</p>
        <p className="pb-3 text-center text-xs font-bold text-red-600">Unavailable</p>
      </div>
    );
  }

  return (
    <Link to={plan.link} className="interactive-card group">
      {imageBlock}
      {label}
    </Link>
  );
}

export default function DataPlanGrid({ plans = DATA_PLANS, title, subtitle, appendCard }) {
  const { data: allPackages = [], isLoading } = useQuery({
    queryKey: ['packages-all'],
    queryFn: () => api.get('/packages').then((r) => r.data.packages),
    staleTime: 0,
  });

  const isPlanAvailable = (plan) => {
    if (plan.alwaysAvailable || plan.isWebDev) return true;
    if (!plan.category) return false;
    const categories = plan.availabilityCategories || [plan.category];
    return categories.some((category) => {
      const categoryPackages = allPackages.filter((p) => p.category === category);
      if (!categoryPackages.length) return false;
      return categoryPackages.some((p) => p.isActive !== false && p.isAvailable !== false);
    });
  };

  return (
    <div>
      {title && (
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-2 text-sm text-gray-600">{subtitle}</p>}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="aspect-square animate-pulse rounded-2xl bg-gray-200" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <DataPlanCard key={plan.id} plan={plan} isAvailable={isPlanAvailable(plan)} />
          ))}
          {appendCard}
        </div>
      )}
    </div>
  );
}

export { DataPlanCard };

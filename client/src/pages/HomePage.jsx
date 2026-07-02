import DataPlanGrid, { DATA_PLANS } from '../components/services/DataPlanGrid';

const HOME_PLAN_IDS = ['mtn', 'telecel', 'airteltigo', 'afa', 'waec', 'web-dev'];

const dataPlans = HOME_PLAN_IDS.map((id) => DATA_PLANS.find((p) => p.id === id)).filter(Boolean);

export default function HomePage() {
  return (
    <div className="px-4 py-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <div>
          <h1 className="max-w-3xl text-base font-bold tracking-tight text-gray-900 sm:text-lg">
            Affordable Data Bundles, Results Checkers &amp; Modern Websites
          </h1>
          <p className="mt-2 max-w-3xl text-xs font-bold leading-relaxed tracking-tight text-gray-900 sm:text-sm">
            Buy data on MTN, Telecel &amp; AirtelTigo. Purchase BECE &amp; WASSCE result checkers.
            Need a professional and modern website for your business? We&apos;ve got you covered.
          </p>
        </div>

        <div className="mt-6">
          <DataPlanGrid plans={dataPlans} />
        </div>
      </div>
    </div>
  );
}

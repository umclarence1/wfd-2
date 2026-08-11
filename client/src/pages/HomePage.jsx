import DataPlanGrid, { DATA_PLANS } from '../components/services/DataPlanGrid';

const HOME_PLAN_IDS = ['mtn', 'telecel', 'airteltigo', 'afa', 'waec', 'web-dev'];

const dataPlans = HOME_PLAN_IDS.map((id) => DATA_PLANS.find((p) => p.id === id)).filter(Boolean);

export default function HomePage() {
  return (
    <div>
      <div className="px-4 pt-6 sm:pt-8">
        <div className="mx-auto max-w-7xl">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 px-5 py-7 text-white shadow-lg shadow-blue-900/15 sm:px-8 sm:py-9">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sky-300/20 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-12 left-1/3 h-36 w-36 rounded-full bg-indigo-300/15 blur-2xl"
              aria-hidden="true"
            />
            <h1 className="relative text-xl font-extrabold leading-snug tracking-tight sm:text-2xl md:text-3xl">
              Buy affordable data bundles and results checkers
            </h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl">
          <DataPlanGrid plans={dataPlans} />
        </div>
      </div>
    </div>
  );
}

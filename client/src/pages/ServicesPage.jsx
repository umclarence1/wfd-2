import DataPlanGrid from '../components/services/DataPlanGrid';

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
      <div>
        <h1 className="section-title !text-2xl sm:!text-3xl">
          Our <span className="gradient-text">Services</span>
        </h1>
        <p className="mt-2 text-sm text-gray-600">Tap a service to view plans or get started.</p>
      </div>
      <div className="mt-8">
        <DataPlanGrid />
      </div>
    </div>
  );
}

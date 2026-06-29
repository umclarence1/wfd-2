export default function AdminPageHeader({ title, subtitle }) {
  return (
    <div className="admin-page-header">
      <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

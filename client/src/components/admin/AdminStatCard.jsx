const TONES = {
  blue: {
    card: 'border-blue-200/80 bg-gradient-to-br from-blue-50 to-sky-100 shadow-sm shadow-blue-100/50',
    label: 'text-blue-700/80',
    value: 'text-blue-950',
    icon: 'bg-blue-100 text-blue-600 ring-blue-200/80',
  },
  emerald: {
    card: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-100 shadow-sm shadow-emerald-100/50',
    label: 'text-emerald-700/80',
    value: 'text-emerald-950',
    icon: 'bg-emerald-100 text-emerald-600 ring-emerald-200/80',
  },
  amber: {
    card: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-100 shadow-sm shadow-amber-100/50',
    label: 'text-amber-800/80',
    value: 'text-amber-950',
    icon: 'bg-amber-100 text-amber-600 ring-amber-200/80',
  },
  violet: {
    card: 'border-violet-200/80 bg-gradient-to-br from-violet-50 to-purple-100 shadow-sm shadow-violet-100/50',
    label: 'text-violet-700/80',
    value: 'text-violet-950',
    icon: 'bg-violet-100 text-violet-600 ring-violet-200/80',
  },
  rose: {
    card: 'border-rose-200/80 bg-gradient-to-br from-rose-50 to-pink-100 shadow-sm shadow-rose-100/50',
    label: 'text-rose-700/80',
    value: 'text-rose-950',
    icon: 'bg-rose-100 text-rose-600 ring-rose-200/80',
  },
  slate: {
    card: 'border-slate-200/80 bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm shadow-slate-100/50',
    label: 'text-slate-600/80',
    value: 'text-slate-900',
    icon: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  },
  teal: {
    card: 'border-teal-200/80 bg-gradient-to-br from-teal-50 to-cyan-100 shadow-sm shadow-teal-100/50',
    label: 'text-teal-700/80',
    value: 'text-teal-950',
    icon: 'bg-teal-100 text-teal-600 ring-teal-200/80',
  },
  indigo: {
    card: 'border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-indigo-100 shadow-sm shadow-indigo-100/50',
    label: 'text-indigo-700/80',
    value: 'text-indigo-950',
    icon: 'bg-indigo-100 text-indigo-600 ring-indigo-200/80',
  },
};

export default function AdminStatCard({ label, value, icon: Icon, tone = 'blue' }) {
  const style = TONES[tone] || TONES.blue;

  return (
    <div
      className={`group rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${style.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-medium ${style.label}`}>{label}</p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${style.value}`}>{value}</p>
        </div>
        {Icon && (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105 ${style.icon}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}

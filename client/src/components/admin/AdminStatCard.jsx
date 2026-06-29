const TONES = {
  blue: {
    card: 'border-blue-400/30 bg-gradient-to-br from-blue-600 to-blue-700 shadow-blue-600/30',
    icon: 'bg-white/20 ring-white/25',
  },
  emerald: {
    card: 'border-emerald-400/30 bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-emerald-600/30',
    icon: 'bg-white/20 ring-white/25',
  },
  amber: {
    card: 'border-amber-400/30 bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30',
    icon: 'bg-white/20 ring-white/25',
  },
  violet: {
    card: 'border-violet-400/30 bg-gradient-to-br from-violet-600 to-violet-700 shadow-violet-600/30',
    icon: 'bg-white/20 ring-white/25',
  },
  rose: {
    card: 'border-rose-400/30 bg-gradient-to-br from-rose-600 to-rose-700 shadow-rose-600/30',
    icon: 'bg-white/20 ring-white/25',
  },
  slate: {
    card: 'border-slate-500/30 bg-gradient-to-br from-slate-700 to-slate-800 shadow-slate-700/30',
    icon: 'bg-white/20 ring-white/25',
  },
  teal: {
    card: 'border-teal-400/30 bg-gradient-to-br from-teal-600 to-cyan-700 shadow-teal-600/30',
    icon: 'bg-white/20 ring-white/25',
  },
  indigo: {
    card: 'border-indigo-400/30 bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-indigo-600/30',
    icon: 'bg-white/20 ring-white/25',
  },
};

export default function AdminStatCard({ label, value, icon: Icon, tone = 'blue' }) {
  const style = TONES[tone] || TONES.blue;

  return (
    <div
      className={`group rounded-2xl border p-5 text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${style.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white/85">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>
        </div>
        {Icon && (
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ring-1 transition-transform duration-200 group-hover:scale-105 ${style.icon}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}

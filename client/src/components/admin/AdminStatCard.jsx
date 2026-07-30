const TONES = {
  blue: {
    card: 'border-blue-500/20 bg-[#111827]',
    label: 'text-slate-400',
    value: 'text-white',
    hint: 'text-blue-400',
    icon: 'bg-blue-500/15 text-blue-400',
  },
  emerald: {
    card: 'border-emerald-500/25 bg-[#111827]',
    label: 'text-slate-400',
    value: 'text-white',
    hint: 'text-emerald-400',
    icon: 'bg-emerald-500/15 text-emerald-400',
  },
  amber: {
    card: 'border-amber-500/20 bg-[#111827]',
    label: 'text-slate-400',
    value: 'text-white',
    hint: 'text-amber-400',
    icon: 'bg-amber-500/15 text-amber-400',
  },
  violet: {
    card: 'border-violet-500/20 bg-[#111827]',
    label: 'text-slate-400',
    value: 'text-white',
    hint: 'text-violet-400',
    icon: 'bg-violet-500/15 text-violet-400',
  },
  rose: {
    card: 'border-rose-500/20 bg-[#111827]',
    label: 'text-slate-400',
    value: 'text-white',
    hint: 'text-rose-400',
    icon: 'bg-rose-500/15 text-rose-400',
  },
  sky: {
    card: 'border-sky-500/20 bg-[#111827]',
    label: 'text-slate-400',
    value: 'text-white',
    hint: 'text-sky-400',
    icon: 'bg-sky-500/15 text-sky-400',
  },
  gold: {
    card: 'border-amber-400/25 bg-[#111827]',
    label: 'text-slate-400',
    value: 'text-white',
    hint: 'text-amber-300',
    icon: 'bg-amber-400/15 text-amber-300',
  },
};

export default function AdminStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'blue',
  className = '',
}) {
  const style = TONES[tone] || TONES.blue;

  return (
    <div
      className={`group rounded-2xl border p-5 transition-all duration-200 hover:border-white/20 hover:bg-[#151c2c] ${style.card} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-[0.14em] ${style.label}`}>{label}</p>
          <p className={`mt-3 text-2xl font-bold tracking-tight sm:text-3xl ${style.value}`}>{value}</p>
          {hint != null && hint !== '' && (
            <p className={`mt-2 text-sm font-medium ${style.hint}`}>{hint}</p>
          )}
        </div>
        {Icon && (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${style.icon}`}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}

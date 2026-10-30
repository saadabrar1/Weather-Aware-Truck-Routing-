import { LEVELS, formatTime } from "../risk";

type Props = {
  start: string | null;
  hours: number;
  hour: number;
  onChange: (hour: number) => void;
  loading: boolean;
  error: string | null;
};

const TICKS = [0, 12, 24, 36, 48];

// Hour 0 is the departure hour; the heatmap shows the forecast at start + hour.
export default function ForecastSlider({ start, hours, hour, onChange, loading, error }: Props) {
  const at = start ? new Date(new Date(start).getTime() + hour * 3_600_000) : null;
  return (
    <div className="border-ink-600 bg-ink-900/90 rounded-xl border p-3 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Corridor weather risk
        </span>
        {error ? (
          <span className="text-xs text-red-300">{error}</span>
        ) : loading ? (
          <span className="animate-pulse text-xs text-slate-400">Loading 48 h forecast…</span>
        ) : (
          at && <span className="text-xs text-slate-400">{formatTime(at)}</span>
        )}
      </div>
      <div className="mt-1 flex items-center gap-3">
        <span className="text-turq w-16 shrink-0 text-2xl font-extrabold tabular-nums">
          +{hour}
          <span className="text-sm font-semibold text-slate-400"> h</span>
        </span>
        <input
          type="range"
          min={0}
          max={hours - 1}
          step={1}
          value={hour}
          disabled={!start}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Forecast hour after departure"
          aria-valuetext={at ? `${hour} hours after departure, ${formatTime(at)}` : undefined}
          list="forecast-ticks"
          className="accent-turq w-full disabled:opacity-40"
        />
      </div>
      <datalist id="forecast-ticks">
        {TICKS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <div className="mt-0.5 ml-[4.75rem] flex justify-between text-[11px] text-slate-400 tabular-nums">
        {TICKS.map((t) => (
          <span key={t}>{t}h</span>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {LEVELS.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}

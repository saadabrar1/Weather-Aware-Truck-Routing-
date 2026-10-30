import { LEVELS, formatTime } from "../risk";

type Props = {
  start: string | null;
  hours: number;
  hour: number;
  onChange: (hour: number) => void;
  loading: boolean;
  error: string | null;
};

// Hour 0 is the departure hour; the heatmap shows the forecast at start + hour.
export default function ForecastSlider({ start, hours, hour, onChange, loading, error }: Props) {
  const at = start ? new Date(new Date(start).getTime() + hour * 3_600_000) : null;
  return (
    <div className="rounded-lg bg-white/95 p-3 shadow-lg ring-1 ring-slate-200 backdrop-blur">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-700">Corridor weather risk</span>
        <span className="tabular-nums text-slate-600">
          {loading ? "Loading forecast…" : error ? error : at ? `+${hour} h · ${formatTime(at)}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={hours - 1}
        step={1}
        value={hour}
        disabled={!start}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Forecast hour after departure"
        className="w-full accent-blue-700"
      />
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
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

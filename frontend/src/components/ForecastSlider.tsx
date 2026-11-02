import { useMemo } from "react";
import type { Heatmap } from "../api";
import type { TruckState } from "../geo";
import { LEVELS, formatTime } from "../risk";

const TICKS = [0, 12, 24, 36, 48];

type Props = {
  routeLetter: string;
  /** Worst level among corridor points on the selected route, at this hour. */
  routeWorst: number | null;
  truck: TruckState | null;
  heatmap: Heatmap | null;
  hour: number;
  onChange: (hour: number) => void;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
};

// Hour 0 is the departure hour; the corridor layer shows the forecast at
// start + hour. The summary line is computed from the same corridor data.
export default function ForecastSlider({
  routeLetter,
  routeWorst,
  truck,
  heatmap,
  hour,
  onChange,
  loading,
  error,
  onRetry,
}: Props) {
  const hours = heatmap?.hours ?? 49;
  const at = heatmap ? new Date(new Date(heatmap.start).getTime() + hour * 3_600_000) : null;

  const summary = useMemo(() => {
    if (!heatmap) return null;
    const levels = heatmap.points.map((p) => p.risk[hour] ?? 0);
    return {
      worst: Math.max(0, ...levels),
      elevated: levels.filter((l) => l >= 1).length,
      total: levels.length,
    };
  }, [heatmap, hour]);

  return (
    <div className="border-ink-600 bg-ink-900/90 rounded-xl border p-3 shadow-2xl shadow-black/50 backdrop-blur">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Corridor weather risk
        </span>
        {at && !loading && <span className="text-xs text-slate-400">{formatTime(at)}</span>}
      </div>

      {error ? (
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-red-200">
          <span>Corridor forecast unavailable: {error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 rounded-md border border-red-400/40 px-2 py-0.5 font-semibold text-red-100 hover:bg-red-500/20"
            >
              Try again
            </button>
          )}
        </div>
      ) : (
        <>
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
              disabled={!heatmap}
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
          <div
            className="mt-2 min-h-[2.5rem] space-y-0.5 text-xs text-slate-300"
            aria-live="polite"
          >
            {loading ? (
              <span className="animate-pulse text-slate-400">
                Loading the 48-hour corridor forecast…
              </span>
            ) : summary ? (
              <>
                <p>
                  Along Route {routeLetter} at +{hour} h:{" "}
                  {routeWorst === null ? (
                    <span className="text-slate-400">no corridor points on this road</span>
                  ) : (
                    <span className="font-bold" style={{ color: LEVELS[routeWorst].color }}>
                      {LEVELS[routeWorst].label}
                    </span>
                  )}
                  {truck && <span className="text-slate-400"> · {truckText(truck)}</span>}
                </p>
                <p className="text-slate-400">
                  Corridor worst:{" "}
                  <span className="font-semibold" style={{ color: LEVELS[summary.worst].color }}>
                    {LEVELS[summary.worst].label}
                  </span>{" "}
                  · {summary.elevated} of {summary.total} points Moderate or worse
                </p>
              </>
            ) : null}
          </div>
          <p className="border-ink-700 mt-2 border-t pt-1.5 text-[11px] text-slate-400">
            Map: weather at the slider hour. Route cards: weather when the truck reaches each
            checkpoint.
          </p>
        </>
      )}

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

function truckText(truck: TruckState): string {
  if (truck.kind !== "driving") {
    return truck.kind === "waiting" ? "truck not departed yet" : "truck has arrived";
  }
  return `truck at mile ${Math.round(truck.mile)} of ${Math.round(truck.totalMiles)}`;
}

import { useMemo } from "react";
import type { Heatmap } from "../api";
import type { TruckState } from "../geo";
import { LEVELS, formatClock, timeZoneLabel } from "../risk";

const TICKS = [0, 12, 24, 36, 48];

type Props = {
  routeLetter: string;
  /** Level at the corridor point nearest the truck, at this hour. */
  atTruck: number | null;
  /** Worst level on the selected route ahead of the truck, at this hour. */
  aheadWorst: number | null;
  truck: TruckState | null;
  heatmap: Heatmap | null;
  hour: number;
  onChange: (hour: number) => void;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
};

// A timeline docked under the map, like a radar playback bar. Hour 0 is the
// departure hour; the map shows the corridor forecast at start + hour, and the
// readout is computed from the same corridor data.
export default function ForecastSlider({
  routeLetter,
  atTruck,
  aheadWorst,
  truck,
  heatmap,
  hour,
  onChange,
  loading,
  error,
  onRetry,
}: Props) {
  const hours = heatmap?.hours ?? 49;
  const startMs = heatmap ? Date.parse(heatmap.start) : null;
  const at = startMs !== null ? new Date(startMs + hour * 3_600_000) : null;

  const corridor = useMemo(() => {
    if (!heatmap) return null;
    const levels = heatmap.points.map((p) => p.risk[hour] ?? 0);
    return {
      worst: Math.max(0, ...levels),
      elevated: levels.filter((l) => l >= 1).length,
      total: levels.length,
    };
  }, [heatmap, hour]);

  return (
    <section
      aria-label="Corridor weather forecast"
      className="border-rule bg-panel border-t px-4 pt-3 pb-3 md:px-5"
    >
      <div className="grid gap-x-6 gap-y-3 md:grid-cols-[9rem_minmax(0,1fr)_15rem] md:items-start xl:grid-cols-[9rem_minmax(0,1fr)_18rem]">
        <div>
          <h2 className="text-ink-3 text-[13px] font-semibold">Corridor forecast</h2>
          <p className="text-[26px] leading-tight font-extrabold tabular-nums">+{hour} h</p>
          <p className="text-ink-2 text-[13px] tabular-nums">
            {at ? `${formatClock(at)} ${timeZoneLabel(at.toISOString())}` : "after departure"}
          </p>
        </div>

        <div className="md:pt-5">
          {error ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
              <span>Corridor forecast unavailable: {error}</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="shrink-0 rounded-md border border-red-300 bg-white px-2 py-0.5 font-semibold hover:bg-red-100"
                >
                  Try again
                </button>
              )}
            </div>
          ) : (
            <>
              <input
                type="range"
                min={0}
                max={hours - 1}
                step={1}
                value={hour}
                disabled={!heatmap}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label="Forecast hour after departure"
                aria-valuetext={
                  at ? `${hour} hours after departure, ${formatClock(at)}` : undefined
                }
                list="forecast-ticks"
                className="accent-shield h-6 w-full disabled:opacity-40"
              />
              <datalist id="forecast-ticks">
                {TICKS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <div className="text-ink-3 mt-0.5 flex justify-between text-[11px] tabular-nums">
                {TICKS.map((t) => (
                  <span key={t} className="text-center">
                    <span className="text-ink-2 block font-semibold">{t} h</span>
                    {startMs !== null && (
                      <span className="hidden sm:block">
                        {formatClock(new Date(startMs + t * 3_600_000))}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="text-[13px]" aria-live="polite">
          {loading ? (
            <p className="text-ink-3 animate-pulse">Loading the 48-hour corridor forecast…</p>
          ) : corridor ? (
            <dl className="space-y-1">
              {truck && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-2">Truck on Route {routeLetter}</dt>
                  <dd className="font-semibold whitespace-nowrap tabular-nums">
                    {truckText(truck)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2 whitespace-nowrap">At the truck</dt>
                <dd className="font-bold">
                  <Level level={atTruck} none="no forecast point nearby" />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2 whitespace-nowrap">Ahead on the route</dt>
                <dd className="font-bold">
                  <Level
                    level={aheadWorst}
                    none={truck?.kind === "arrived" ? "nothing left to drive" : "no data"}
                  />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-2 whitespace-nowrap">Whole corridor</dt>
                <dd className="font-bold" style={{ color: LEVELS[corridor.worst].ink }}>
                  {LEVELS[corridor.worst].label}
                </dd>
              </div>
              <p className="text-ink-3 text-right text-[12px]">
                {corridor.elevated} of {corridor.total} corridor points above Low
              </p>
            </dl>
          ) : null}
        </div>
      </div>

      <div className="border-rule-2 mt-2.5 flex flex-col gap-2 border-t pt-2 text-[12px] md:flex-row md:items-center md:justify-between">
        <p className="text-ink-3">
          The map shows weather at the chosen hour. Weather behind the truck is left out of the
          route lines; route results use the hour the truck reaches each checkpoint.
        </p>
        <ul
          className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1"
          aria-label="Risk scale"
        >
          {LEVELS.map((l) => (
            <li key={l.key} className="text-ink-2 inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: l.color }} />
              {l.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function truckText(truck: TruckState): string {
  if (truck.kind !== "driving") {
    return truck.kind === "waiting" ? "not departed yet" : "arrived";
  }
  return `mile ${Math.round(truck.mile)} of ${Math.round(truck.totalMiles)}`;
}

function Level({ level, none }: { level: number | null; none: string }) {
  if (level === null) return <span className="text-ink-3 font-normal">{none}</span>;
  return <span style={{ color: LEVELS[level].ink }}>{LEVELS[level].label}</span>;
}

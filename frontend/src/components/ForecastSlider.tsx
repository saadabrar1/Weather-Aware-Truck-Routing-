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
  /** Worst level anywhere on the selected route, at this hour. */
  routeAny: number | null;
  /** The selected route's planned arrival (last checkpoint ETA). */
  arrival: string | null;
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
  routeAny,
  arrival,
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
      // A fixed minimum height, so the map above doesn't shrink again when the
      // forecast arrives and replaces the loading line with the readout.
      className="border-rule bg-panel border-t px-4 pt-3 pb-3 md:min-h-[200px] md:px-5"
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
                <Row label="Truck, if on schedule">
                  <span className="font-semibold whitespace-nowrap tabular-nums">
                    {truckText(truck, arrival)}
                  </span>
                </Row>
              )}
              <Row label="At that point">
                <Level level={atTruck} none="no forecast point nearby" />
              </Row>
              <Row label="Still ahead">
                <Level
                  level={aheadWorst}
                  none={truck?.kind === "arrived" ? "none if on schedule" : "no data"}
                />
              </Row>
              <Row label={`Anywhere on Route ${routeLetter}`}>
                <Level level={routeAny} none="no data" />
              </Row>
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
          The map shows weather at the chosen hour. The truck's position assumes it keeps to
          schedule; if it runs late, check "Anywhere on Route {routeLetter}". Route results use the
          planned arrival at each checkpoint.
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

function truckText(truck: TruckState, arrival: string | null): string {
  if (truck.kind !== "driving") {
    if (truck.kind === "waiting") return "not departed yet";
    return arrival ? `arrived ${formatClock(arrival)}` : "arrived";
  }
  return `mile ${Math.round(truck.mile)} of ${Math.round(truck.totalMiles)}`;
}

function Level({ level, none }: { level: number | null; none: string }) {
  if (level === null) return <span className="text-ink-3 font-normal">{none}</span>;
  return <span style={{ color: LEVELS[level].ink }}>{LEVELS[level].label}</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-2 whitespace-nowrap">{label}</dt>
      <dd className="font-bold">{children}</dd>
    </div>
  );
}

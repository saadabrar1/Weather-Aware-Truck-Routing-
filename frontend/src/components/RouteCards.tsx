import { useEffect, useRef } from "react";
import type { Checkpoint, Plan, RouteOption } from "../api";
import {
  LEVELS,
  ROUTE_LETTERS,
  formatClock,
  formatDuration,
  peakLevel,
  timeZoneLabel,
} from "../risk";
import Shield from "./Shield";

export type CheckpointFocus = { routeId: string; checkpoint: Checkpoint; fly: boolean } | null;

type Props = {
  plan: Plan;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFocusCheckpoint: (focus: CheckpointFocus) => void;
};

// The routes as a dispatch board: one ruled ledger, best first, each row
// carrying a strip map of where along the trip the risk sits.
export default function RouteCards({ plan, selectedId, onSelect, onFocusCheckpoint }: Props) {
  const byRank = [...plan.routes].sort((a, b) => a.rank - b.rank);
  const letter = (r: RouteOption) => ROUTE_LETTERS[plan.routes.indexOf(r)];
  const best = plan.routes.find((r) => r.id === plan.recommended_id)!;
  const selected = plan.routes.find((r) => r.id === selectedId);

  return (
    <div className="space-y-6">
      {plan.warnings.map((w) => (
        <p
          key={w}
          role="status"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {w}
        </p>
      ))}

      <section aria-labelledby="routes-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="routes-heading" className="text-[17px] font-bold">
            Routes
          </h2>
          <span className="text-ink-3 text-[13px]">Best first</span>
        </div>
        <p className="text-ink-3 mt-0.5 text-[13px]">
          Ranked by Severe miles, then High miles, average risk and time.
        </p>
        <ul className="border-rule mt-3 border-t" aria-label="Route options, best first">
          {byRank.map((r) => (
            <li key={r.id} className="border-rule border-b">
              <RouteRow
                route={r}
                letter={letter(r)}
                best={best}
                explanation={plan.explanation}
                selected={r.id === selectedId}
                onSelect={() => onSelect(r.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      {selected && (
        <CheckpointTable
          route={selected}
          letter={letter(selected)}
          onFocus={(checkpoint, fly) =>
            onFocusCheckpoint(checkpoint && { routeId: selected.id, checkpoint, fly })
          }
        />
      )}
    </div>
  );
}

type RowProps = {
  route: RouteOption;
  letter: string;
  best: RouteOption;
  explanation: string;
  selected: boolean;
  onSelect: () => void;
};

function RouteRow({ route, letter, best, explanation, selected, onSelect }: RowProps) {
  const recommended = route.id === best.id;
  const peak = LEVELS[peakLevel(route)];
  const m = route.miles_by_level;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative block w-full px-3 py-3.5 text-left transition-colors ${
        selected ? "bg-[#edf2fa]" : "hover:bg-rule-2/60"
      }`}
    >
      {selected && <span aria-hidden className="bg-shield absolute inset-y-0 left-0 w-[3px]" />}
      <div className="flex items-start gap-3">
        <Shield letter={letter} recommended={recommended} size={30} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[15px] font-bold">
              Route {letter}
              {recommended && (
                <span className="text-shield ml-2 text-[13px] font-semibold">Recommended</span>
              )}
            </span>
            <span className="shrink-0 text-[17px] leading-none font-extrabold tabular-nums">
              {formatDuration(route.duration_s)}
            </span>
          </div>
          <div className="text-ink-3 mt-0.5 flex items-baseline justify-between gap-3 text-[13px]">
            {recommended ? (
              <span className="text-ink-2">{explanation}</span>
            ) : (
              <Delta route={route} best={best} />
            )}
            <span className="shrink-0 tabular-nums">{Math.round(route.distance_mi)} mi</span>
          </div>
        </div>
      </div>

      <StripMap route={route} />

      <dl className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
        <div>
          <dt className="text-ink-3">Peak risk</dt>
          <dd className="font-bold" style={{ color: peak.ink }}>
            {peak.label}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">Severe</dt>
          <dd
            className={`font-bold tabular-nums ${m.severe + m.no_travel > 0 ? "text-[#b01c1c]" : ""}`}
          >
            {Math.round(m.severe)} mi
            {m.no_travel > 0 && (
              <span className="ml-1 font-semibold text-[#6d28b8]">
                +{Math.round(m.no_travel)} No Travel
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-ink-3">High</dt>
          <dd className={`font-bold tabular-nums ${m.high > 0 ? "text-[#b24a00]" : ""}`}>
            {Math.round(m.high)} mi
          </dd>
        </div>
      </dl>
      <p className="text-ink-3 mt-1.5 text-[12px]">
        Average risk {route.avg_risk.toFixed(2)} on a 0–4 scale
      </p>
    </button>
  );
}

// What choosing this route instead of the recommended one costs or saves.
function Delta({ route, best }: { route: RouteOption; best: RouteOption }) {
  const dt = route.duration_s - best.duration_s;
  const dd = Math.round(route.distance_mi - best.distance_mi);
  const sign = (n: number) => (n >= 0 ? "+" : "−");
  const extra: string[] = [];
  for (const [label, key] of [
    ["No Travel", "no_travel"],
    ["Severe", "severe"],
    ["High", "high"],
  ] as const) {
    const d = Math.round(route.miles_by_level[key] - best.miles_by_level[key]);
    if (d !== 0) extra.push(`${sign(d)}${Math.abs(d)} ${label} mi`);
  }
  return (
    <span aria-label="Compared with the recommended route">
      {sign(dt)}
      {formatDuration(Math.abs(dt))}, {sign(dd)}
      {Math.abs(dd)} mi
      {extra.length > 0 && <span className="text-ink-2">, {extra.join(", ")}</span>} vs the
      recommended route
    </span>
  );
}

// A strip map: the trip drawn as one straight bar from origin to destination,
// each stretch coloured by the risk its checkpoint was graded at, so you see
// where the risk sits, not just how much of it there is.
function StripMap({ route }: { route: RouteOption }) {
  const cps = route.checkpoints;
  const total = cps[cps.length - 1]?.mile || 1;
  const stretches = cps.map((c, i) => {
    const start = i === 0 ? 0 : (cps[i - 1].mile + c.mile) / 2;
    const end = i === cps.length - 1 ? total : (c.mile + cps[i + 1].mile) / 2;
    return { level: c.level, start, end };
  });
  return (
    <div className="mt-3" aria-hidden>
      <div className="flex h-2 overflow-hidden rounded-[2px]">
        {stretches.map((s, i) => (
          <span
            key={i}
            style={{
              width: `${((s.end - s.start) / total) * 100}%`,
              background: LEVELS[s.level].color,
            }}
          />
        ))}
      </div>
      <div className="text-ink-3 mt-1 flex justify-between text-[11px] tabular-nums">
        <span>Start</span>
        <span>{Math.round(total)} mi</span>
      </div>
    </div>
  );
}

type TableProps = {
  route: RouteOption;
  letter: string;
  onFocus: (checkpoint: Checkpoint | null, fly: boolean) => void;
};

// Hovering a row highlights its dot on the map; clicking (or Enter) flies there.
function CheckpointTable({ route, letter, onFocus }: TableProps) {
  const scroller = useRef<HTMLDivElement>(null);
  // A new analysis or another route starts the table back at its first row.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [route]);
  const elevated = route.checkpoints.filter((c) => c.level > 0).length;

  return (
    <section aria-labelledby="checkpoints-heading">
      <div className="flex items-baseline justify-between">
        <h2 id="checkpoints-heading" className="text-[17px] font-bold">
          Route {letter} checkpoints
        </h2>
        <span className={`text-[13px] ${elevated ? "font-semibold text-[#b24a00]" : "text-ink-3"}`}>
          {elevated ? `${elevated} above Low` : "All Low"}
        </span>
      </div>
      <p className="text-ink-3 mt-0.5 text-[13px]">
        Weather at the time the truck reaches each point. Select a row to find it on the map.
      </p>
      <div
        ref={scroller}
        className="border-rule mt-3 max-h-80 overflow-auto rounded-md border bg-white"
        onMouseLeave={() => onFocus(null, false)}
      >
        <table className="w-full text-[13px]">
          <thead className="text-ink-2 sticky top-0 bg-[#f7f9fb] text-left shadow-[inset_0_-1px_0_var(--color-rule)]">
            <tr>
              <th className="px-2.5 py-2 font-semibold">Mile</th>
              <th className="px-2.5 py-2 font-semibold">
                Arrives <Unit>{timeZoneLabel(route.checkpoints[0].eta)}</Unit>
              </th>
              <th className="px-2.5 py-2 font-semibold">Risk</th>
              <th className="px-2.5 py-2 text-right font-semibold">
                Wind <Unit>mph</Unit>
              </th>
              <th className="px-2.5 py-2 text-right font-semibold">
                Rain <Unit>in/h</Unit>
              </th>
              <th className="px-2.5 py-2 text-right font-semibold">
                Snow <Unit>in/h</Unit>
              </th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((c) => (
              <tr
                key={c.mile}
                tabIndex={0}
                className="border-rule-2 cursor-pointer border-t even:bg-[#fafbfc] hover:bg-[#edf2fa] focus-visible:bg-[#edf2fa]"
                // A risk-coloured edge makes anything above Low easy to spot.
                style={
                  c.level > 0 ? { boxShadow: `inset 3px 0 0 ${LEVELS[c.level].color}` } : undefined
                }
                title={c.reasons.join("\n") || "Show on map"}
                onMouseEnter={() => onFocus(c, false)}
                onFocus={() => onFocus(c, false)}
                onClick={() => onFocus(c, true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFocus(c, true);
                  }
                }}
              >
                <td className="px-2.5 py-1.5 font-semibold tabular-nums">{Math.round(c.mile)}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap">{formatClock(c.eta)}</td>
                <td className="px-2.5 py-1.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: LEVELS[c.level].color }}
                    />
                    <span style={{ color: LEVELS[c.level].ink }}>{LEVELS[c.level].label}</span>
                  </span>
                </td>
                <td className="text-ink-2 px-2.5 py-1.5 text-right tabular-nums">
                  {Math.round(c.wind_mph)}
                </td>
                <td className="text-ink-2 px-2.5 py-1.5 text-right tabular-nums">
                  {c.rain_in_hr.toFixed(2)}
                </td>
                <td className="text-ink-2 px-2.5 py-1.5 text-right tabular-nums">
                  {c.snow_in_hr.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Units sit under the column name so the cells hold only numbers.
function Unit({ children }: { children: string }) {
  return <span className="text-ink-3 block text-[11px] font-normal">{children}</span>;
}

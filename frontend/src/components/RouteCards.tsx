import type { Checkpoint, Plan, RouteOption } from "../api";
import {
  LEVELS,
  ROUTE_LETTERS,
  formatClock,
  formatDuration,
  peakLevel,
  timeZoneLabel,
} from "../risk";

export type CheckpointFocus = { routeId: string; checkpoint: Checkpoint; fly: boolean } | null;

type Props = {
  plan: Plan;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFocusCheckpoint: (focus: CheckpointFocus) => void;
};

export default function RouteCards({ plan, selectedId, onSelect, onFocusCheckpoint }: Props) {
  const byRank = [...plan.routes].sort((a, b) => a.rank - b.rank);
  const letter = (r: RouteOption) => ROUTE_LETTERS[plan.routes.indexOf(r)];
  const best = plan.routes.find((r) => r.id === plan.recommended_id)!;
  const selected = plan.routes.find((r) => r.id === selectedId);

  return (
    <div className="space-y-3">
      {plan.warnings.map((w) => (
        <p
          key={w}
          role="status"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          {w}
        </p>
      ))}

      <ul className="space-y-2" aria-label="Route options, best first">
        {byRank.map((r) => (
          <li key={r.id}>
            <RouteCard
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

type CardProps = {
  route: RouteOption;
  letter: string;
  best: RouteOption;
  explanation: string;
  selected: boolean;
  onSelect: () => void;
};

function RouteCard({ route, letter, best, explanation, selected, onSelect }: CardProps) {
  const recommended = route.id === best.id;
  const peak = LEVELS[peakLevel(route)];
  const m = route.miles_by_level;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full overflow-hidden rounded-xl border text-left transition ${
        recommended ? "bg-ink-800 border-turq/50" : "bg-ink-800/70 border-ink-600 hover:bg-ink-700"
      } ${selected ? "ring-turq/60 ring-2" : ""}`}
    >
      {recommended && (
        <div className="from-deep border-turq/30 border-b bg-gradient-to-r to-transparent px-3 py-2">
          <div className="text-turq flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden>
              <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
            </svg>
            Recommended
          </div>
          <p className="mt-0.5 text-xs text-slate-300">{explanation}</p>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 font-semibold">
            <RouteBadge letter={letter} recommended={recommended} />
            Route {letter}
            {route.name && (
              <span className="truncate font-normal text-slate-400">· {route.name}</span>
            )}
          </span>
          {!recommended && (
            <span className="text-[11px] font-semibold text-slate-400">Rank #{route.rank}</span>
          )}
        </div>

        {!recommended && <Deltas route={route} best={best} />}

        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Peak risk
            </div>
            <div className="text-xl leading-tight font-extrabold" style={{ color: peak.color }}>
              {peak.label}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            avg risk{" "}
            <span className="font-semibold text-slate-200">{route.avg_risk.toFixed(2)}</span> / 4
          </div>
        </div>

        <dl className="mt-2 grid grid-cols-4 gap-1.5 text-center">
          <Stat label="Distance" value={`${Math.round(route.distance_mi)} mi`} />
          <Stat label="Time" value={formatDuration(route.duration_s)} />
          <Stat label="Severe" value={`${Math.round(m.severe)} mi`} alert={m.severe > 0} />
          <Stat label="High" value={`${Math.round(m.high)} mi`} alert={m.high > 0} />
        </dl>

        <RiskBar route={route} />
      </div>
    </button>
  );
}

export function RouteBadge({ letter, recommended }: { letter: string; recommended: boolean }) {
  return (
    <span
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-md text-xs font-extrabold ${
        recommended ? "bg-turq text-ink-950" : "bg-ink-600 text-slate-200"
      }`}
    >
      {letter}
    </span>
  );
}

// What choosing this route instead of the recommended one costs or saves.
function Deltas({ route, best }: { route: RouteOption; best: RouteOption }) {
  const dt = route.duration_s - best.duration_s;
  const dd = route.distance_mi - best.distance_mi;
  const dSevere = route.miles_by_level.severe - best.miles_by_level.severe;
  const dHigh = route.miles_by_level.high - best.miles_by_level.high;
  const dNoTravel = route.miles_by_level.no_travel - best.miles_by_level.no_travel;
  const chips: { text: string; worse: boolean }[] = [
    { text: `${dt >= 0 ? "+" : "−"}${formatDuration(Math.abs(dt))}`, worse: dt > 0 },
    { text: `${dd >= 0 ? "+" : "−"}${Math.abs(Math.round(dd))} mi`, worse: dd > 0 },
  ];
  for (const [label, diff] of [
    ["No Travel", dNoTravel],
    ["Severe", dSevere],
    ["High", dHigh],
  ] as const) {
    if (Math.round(diff) !== 0) {
      chips.push({
        text: `${diff > 0 ? "+" : "−"}${Math.abs(Math.round(diff))} ${label} mi`,
        worse: diff > 0,
      });
    }
  }
  return (
    <div className="mt-1.5 flex flex-wrap gap-1" aria-label="Compared with the recommended route">
      {chips.map((c) => (
        <span
          key={c.text}
          className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
            c.worse ? "bg-orange-500/10 text-orange-300" : "bg-green-500/10 text-green-300"
          }`}
        >
          {c.text}
        </span>
      ))}
      <span className="self-center text-[11px] text-slate-400">vs recommended</span>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-ink-900/70 rounded-md px-1 py-1.5">
      <dt className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className={`text-xs font-semibold ${alert ? "text-orange-300" : "text-slate-100"}`}>
        {value}
      </dd>
    </div>
  );
}

function RiskBar({ route }: { route: RouteOption }) {
  const total = LEVELS.reduce((s, l) => s + route.miles_by_level[l.key], 0) || 1;
  return (
    <div className="mt-2.5">
      <div className="bg-ink-900 flex h-1.5 gap-px overflow-hidden rounded-full">
        {LEVELS.map((l) => {
          const mi = route.miles_by_level[l.key];
          return mi > 0 ? (
            <div
              key={l.key}
              style={{ width: `${(mi / total) * 100}%`, background: l.color }}
              title={`${l.label}: ${mi} mi`}
            />
          ) : null;
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
        {LEVELS.filter((l) => route.miles_by_level[l.key] > 0).map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
            {l.label} {Math.round(route.miles_by_level[l.key])} mi
          </span>
        ))}
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
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        Route {letter} · {route.checkpoints.length} weather checkpoints
      </h3>
      <div
        className="border-ink-600 bg-ink-800 max-h-80 overflow-auto rounded-xl border"
        onMouseLeave={() => onFocus(null, false)}
      >
        <table className="w-full text-xs">
          <thead className="bg-ink-700 sticky top-0 text-left text-[11px] tracking-wide text-slate-300 uppercase">
            <tr>
              <th className="px-2 py-1.5 font-semibold">Mile</th>
              <th className="px-2 py-1.5 font-semibold">
                ETA <Unit>{timeZoneLabel(route.checkpoints[0].eta)}</Unit>
              </th>
              <th className="px-2 py-1.5 font-semibold">Risk</th>
              <th className="px-2 py-1.5 text-right font-semibold">
                Wind <Unit>mph</Unit>
              </th>
              <th className="px-2 py-1.5 text-right font-semibold">
                Rain <Unit>in/h</Unit>
              </th>
              <th className="px-2 py-1.5 text-right font-semibold">
                Snow <Unit>in/h</Unit>
              </th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((c) => (
              <tr
                key={c.mile}
                tabIndex={0}
                className="border-ink-700 hover:bg-ink-700 focus-visible:bg-ink-700 cursor-pointer border-t text-slate-200"
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
                <td className="px-2 py-1.5 tabular-nums">{Math.round(c.mile)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatClock(c.eta)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: LEVELS[c.level].color }}
                    />
                    {LEVELS[c.level].label}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-right text-slate-300 tabular-nums">
                  {Math.round(c.wind_mph)}
                </td>
                <td className="px-2 py-1.5 text-right text-slate-300 tabular-nums">
                  {c.rain_in_hr.toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-right text-slate-300 tabular-nums">
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
  return (
    <span className="block text-[11px] font-normal tracking-normal text-slate-400 normal-case">
      {children}
    </span>
  );
}

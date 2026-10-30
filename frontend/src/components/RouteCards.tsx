import type { Plan, RouteOption } from "../api";
import { LEVELS, ROUTE_LETTERS, formatDuration, formatTime, peakLevel } from "../risk";

type Props = { plan: Plan; selectedId: string | null; onSelect: (id: string) => void };

export default function RouteCards({ plan, selectedId, onSelect }: Props) {
  const byRank = [...plan.routes].sort((a, b) => a.rank - b.rank);
  const letter = (r: RouteOption) => ROUTE_LETTERS[plan.routes.indexOf(r)];
  const best = plan.routes.find((r) => r.id === plan.recommended_id)!;
  const selected = plan.routes.find((r) => r.id === selectedId);

  return (
    <div className="space-y-3">
      {plan.warnings.map((w) => (
        <p
          key={w}
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"
        >
          {w}
        </p>
      ))}

      <div className="border-turq/30 from-deep to-ink-800 rounded-xl border bg-gradient-to-br p-3">
        <div className="text-turq text-[11px] font-semibold tracking-wider uppercase">
          Recommended route
        </div>
        <div className="mt-0.5 text-lg font-bold">
          Route {letter(best)}{" "}
          <span className="font-medium text-slate-300">
            · {formatDuration(best.duration_s)} · {Math.round(best.distance_mi)} mi
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-300">{plan.explanation}</p>
      </div>

      <ul className="space-y-2">
        {byRank.map((r) => (
          <li key={r.id}>
            <RouteCard
              route={r}
              letter={letter(r)}
              recommended={r.id === plan.recommended_id}
              selected={r.id === selectedId}
              onSelect={() => onSelect(r.id)}
            />
          </li>
        ))}
      </ul>

      {selected && <CheckpointTable route={selected} letter={letter(selected)} />}
    </div>
  );
}

type CardProps = {
  route: RouteOption;
  letter: string;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
};

function RouteCard({ route, letter, recommended, selected, onSelect }: CardProps) {
  const peak = LEVELS[peakLevel(route)];
  const m = route.miles_by_level;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`bg-ink-800 w-full rounded-xl border p-3 text-left transition ${
        selected
          ? "border-turq/60 shadow-[0_0_0_1px_rgba(64,224,208,0.25),0_8px_24px_-8px_rgba(64,224,208,0.25)]"
          : "border-ink-600 hover:border-ink-600 hover:bg-ink-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          Route {letter}
          {route.name && <span className="font-normal text-slate-400"> · {route.name}</span>}
        </span>
        {recommended ? (
          <span className="bg-turq/15 text-turq rounded-full px-2 py-0.5 text-[11px] font-bold">
            Recommended
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-slate-500">Rank #{route.rank}</span>
        )}
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Peak risk
          </div>
          <div className="text-xl leading-tight font-extrabold" style={{ color: peak.color }}>
            {peak.label}
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          avg risk <span className="font-semibold text-slate-200">{route.avg_risk.toFixed(2)}</span>{" "}
          / 4
        </div>
      </div>

      <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
        <Stat label="Distance" value={`${Math.round(route.distance_mi)} mi`} />
        <Stat label="Time" value={formatDuration(route.duration_s)} />
        <Stat label="Severe" value={`${Math.round(m.severe)} mi`} alert={m.severe > 0} />
        <Stat label="High" value={`${Math.round(m.high)} mi`} alert={m.high > 0} />
      </dl>

      <RiskBar route={route} />
    </button>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-ink-900/70 rounded-md px-1 py-1.5">
      <dt className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">{label}</dt>
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

function CheckpointTable({ route, letter }: { route: RouteOption; letter: string }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        Route {letter} · {route.checkpoints.length} weather checkpoints
      </h3>
      <div className="border-ink-600 bg-ink-800 max-h-72 overflow-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead className="bg-ink-700 sticky top-0 text-left text-[10px] tracking-wider text-slate-400 uppercase">
            <tr>
              <th className="px-2 py-1.5 font-semibold">Mile</th>
              <th className="px-2 py-1.5 font-semibold">ETA</th>
              <th className="px-2 py-1.5 font-semibold">Risk</th>
              <th className="px-2 py-1.5 font-semibold">Wind · Rain · Snow</th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((c) => (
              <tr
                key={c.mile}
                className="border-ink-700 border-t text-slate-200"
                title={c.reasons.join("\n")}
              >
                <td className="px-2 py-1.5 tabular-nums">{Math.round(c.mile)}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatTime(c.eta)}</td>
                <td className="px-2 py-1.5">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: LEVELS[c.level].color }}
                    />
                    {LEVELS[c.level].label}
                  </span>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-400 tabular-nums">
                  {Math.round(c.wind_mph)} mph · {c.rain_in_hr.toFixed(2)} ·{" "}
                  {c.snow_in_hr.toFixed(2)} in/h
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

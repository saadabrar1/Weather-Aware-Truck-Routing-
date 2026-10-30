import type { Plan, RouteOption } from "../api";
import { LEVELS, ROUTE_LETTERS, formatDuration, formatTime } from "../risk";

type Props = { plan: Plan; selectedId: string | null; onSelect: (id: string) => void };

export default function RouteCards({ plan, selectedId, onSelect }: Props) {
  const byRank = [...plan.routes].sort((a, b) => a.rank - b.rank);
  const letter = (r: RouteOption) => ROUTE_LETTERS[plan.routes.indexOf(r)];
  const selected = plan.routes.find((r) => r.id === selectedId);

  return (
    <div className="space-y-3">
      {plan.warnings.map((w) => (
        <p key={w} className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {w}
        </p>
      ))}
      <ul className="space-y-2">
        {byRank.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              aria-pressed={r.id === selectedId}
              className={`w-full rounded-lg border bg-white p-3 text-left transition ${
                r.id === selectedId
                  ? "border-blue-700 ring-2 ring-blue-700/20"
                  : "border-slate-200 hover:border-slate-400"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  Route {letter(r)}
                  {r.name && <span className="font-normal text-slate-500"> · {r.name}</span>}
                </span>
                {r.id === plan.recommended_id ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                    Recommended
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">#{r.rank}</span>
                )}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {r.distance_mi.toLocaleString()} mi · {formatDuration(r.duration_s)} · avg risk{" "}
                {r.avg_risk.toFixed(2)}
              </div>
              {r.id === plan.recommended_id && (
                <p className="mt-1 text-xs text-green-800">{plan.explanation}</p>
              )}
              <RiskBar route={r} />
            </button>
          </li>
        ))}
      </ul>
      {selected && <CheckpointTable route={selected} letter={letter(selected)} />}
    </div>
  );
}

function RiskBar({ route }: { route: RouteOption }) {
  const total = LEVELS.reduce((s, l) => s + route.miles_by_level[l.key], 0) || 1;
  return (
    <div className="mt-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
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
      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-slate-600">
        {LEVELS.filter((l) => route.miles_by_level[l.key] > 0).map((l) => (
          <span key={l.key}>
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
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Route {letter} checkpoints
      </h3>
      <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-2 py-1.5 font-medium">Mile</th>
              <th className="px-2 py-1.5 font-medium">ETA</th>
              <th className="px-2 py-1.5 font-medium">Risk</th>
              <th className="px-2 py-1.5 font-medium">Wind · Rain · Snow</th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((c) => (
              <tr key={c.mile} className="border-t border-slate-100" title={c.reasons.join("\n")}>
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
                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums text-slate-600">
                  {Math.round(c.wind_mph)} mph · {c.rain_in_hr.toFixed(2)} · {c.snow_in_hr.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

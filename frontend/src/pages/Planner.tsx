import { useMemo, useRef, useState } from "react";
import { api, type Heatmap, type Plan, type PlanRequest } from "../api";
import ForecastSlider from "../components/ForecastSlider";
import Logo from "../components/Logo";
import MapLegend from "../components/MapLegend";
import MapView from "../components/MapView";
import RouteCards, { type CheckpointFocus } from "../components/RouteCards";
import TripForm from "../components/TripForm";
import { cumulativeMiles, pointsNearRoute, truckAt } from "../geo";
import { ROUTE_LETTERS } from "../risk";

// Corridor points this close to a route's line count as "on" that route.
const ON_ROUTE_MI = 10;

export default function Planner() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [request, setRequest] = useState<PlanRequest | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heatmap, setHeatmap] = useState<Heatmap | null>(null);
  const [heatLoading, setHeatLoading] = useState(false);
  const [heatError, setHeatError] = useState<string | null>(null);
  const [hour, setHour] = useState(0);
  const [focus, setFocus] = useState<CheckpointFocus>(null);
  // Ignore responses from a search the user has already replaced.
  const latest = useRef(0);

  const loadHeatmap = async (result: Plan, req: PlanRequest, id: number) => {
    setHeatLoading(true);
    setHeatError(null);
    try {
      const heat = await api.heatmap(result.corridor, req.departure, req.weight_lb);
      if (id === latest.current) setHeatmap(heat);
    } catch (e) {
      if (id === latest.current) setHeatError((e as Error).message);
    } finally {
      if (id === latest.current) setHeatLoading(false);
    }
  };

  const search = async (req: PlanRequest) => {
    const id = ++latest.current;
    setRequest(req);
    setLoading(true);
    setError(null);
    setHeatmap(null);
    setHeatError(null);
    setHour(0);
    setFocus(null);
    try {
      const result = await api.plan(req);
      if (id !== latest.current) return;
      setPlan(result);
      setSelectedId(result.recommended_id);
      setLoading(false);
      // Routes are on screen first; the corridor forecast fills in behind them.
      await loadHeatmap(result, req, id);
    } catch (e) {
      if (id !== latest.current) return;
      setError((e as Error).message);
      setLoading(false);
    }
  };

  const selected = plan?.routes.find((r) => r.id === selectedId) ?? null;
  const selectedLetter = selected && plan ? ROUTE_LETTERS[plan.routes.indexOf(selected)] : "";

  // Worked out once per route (and per heatmap), so moving the slider only
  // reads a few array entries.
  const routeMiles = useMemo(
    () => (selected ? cumulativeMiles(selected.geometry) : []),
    [selected],
  );
  const onRoute = useMemo(
    () =>
      selected && heatmap ? pointsNearRoute(heatmap.points, selected.geometry, ON_ROUTE_MI) : [],
    [selected, heatmap],
  );

  // Where the selected route's truck is at the slider hour, from its own ETAs.
  const truck = useMemo(() => {
    if (!selected || !heatmap) return null;
    const when = Date.parse(heatmap.start) + hour * 3_600_000;
    return truckAt(selected, routeMiles, when);
  }, [selected, heatmap, hour, routeMiles]);

  const routeWorst =
    heatmap && onRoute.length
      ? Math.max(0, ...onRoute.map((i) => heatmap.points[i].risk[hour] ?? 0))
      : null;

  const selectRoute = (id: string) => {
    setSelectedId(id);
    setFocus((f) => (f && f.routeId !== id ? null : f));
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside
        className={`${plan ? "order-2" : "order-1"} border-ink-700 bg-ink-900 flex w-full shrink-0 flex-col overflow-y-auto md:order-1 md:w-[420px] md:border-r`}
      >
        <header className="border-ink-700 bg-ink-900/95 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
          <a href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <Logo className="h-7 w-7" />
            <span>
              Weather<span className="text-turq">Route</span>
            </span>
          </a>
          {plan && (
            <span className="bg-ink-700 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Routing · {plan.provider}
            </span>
          )}
        </header>
        <div className="space-y-4 p-4">
          <TripForm loading={loading} onSubmit={search} />
          {error && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              <span>{error}</span>
              {request && (
                <button
                  type="button"
                  onClick={() => search(request)}
                  className="shrink-0 rounded-md border border-red-400/40 px-2 py-0.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
                >
                  Try again
                </button>
              )}
            </div>
          )}
          {loading && <ResultsSkeleton />}
          {plan && !loading && (
            <RouteCards
              plan={plan}
              selectedId={selectedId}
              onSelect={selectRoute}
              onFocusCheckpoint={setFocus}
            />
          )}
        </div>
      </aside>
      {/* On phones the slider sits under the map instead of covering half of it.
          Before the first search the form comes first; after it, the map does. */}
      <main
        className={`${plan ? "order-1" : "order-2"} flex flex-col md:relative md:order-2 md:block md:h-full md:flex-1`}
      >
        <div className="relative h-[52vh] min-h-[300px] md:h-full">
          <MapView
            plan={plan}
            selectedId={selectedId}
            onSelect={selectRoute}
            focus={focus}
            truck={truck?.at ?? null}
            heatmap={heatmap}
            hour={hour}
            originLabel={request?.origin.label}
            destinationLabel={request?.destination.label}
          />
          {!plan && !loading && (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-4">
              <p className="border-ink-600 bg-ink-900/85 rounded-full border px-4 py-2 text-center text-sm text-slate-300 backdrop-blur">
                Enter a trip to compare 3 routes by weather risk at the truck's arrival time
              </p>
            </div>
          )}
          {loading && <MapLoading />}
          {plan && !loading && (
            <div className="absolute top-3 right-3 hidden md:block">
              <MapLegend />
            </div>
          )}
        </div>
        {plan && (
          <div className="border-ink-700 bg-ink-900 border-b p-2 md:absolute md:bottom-8 md:left-4 md:w-[440px] md:border-0 md:bg-transparent md:p-0">
            <ForecastSlider
              routeLetter={selectedLetter}
              routeWorst={routeWorst}
              truck={truck}
              heatmap={heatmap}
              hour={hour}
              onChange={setHour}
              loading={heatLoading}
              error={heatError}
              onRetry={
                request && plan ? () => loadHeatmap(plan, request, latest.current) : undefined
              }
            />
          </div>
        )}
      </main>
    </div>
  );
}

function MapLoading() {
  return (
    <div
      role="status"
      className="bg-ink-950/50 absolute inset-0 grid place-items-center backdrop-blur-[2px]"
    >
      <div className="border-ink-600 bg-ink-900/95 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl">
        <span className="border-turq h-5 w-5 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none" />
        <span className="text-sm text-slate-200">
          Finding 3 routes and reading the forecast at each checkpoint…
        </span>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-ink-800 h-40 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

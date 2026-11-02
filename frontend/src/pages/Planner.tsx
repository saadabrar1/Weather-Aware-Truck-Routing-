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
    <div className="bg-paper flex min-h-full flex-col md:h-full md:flex-row">
      {/* Phones get the header above everything, since the map moves to the
          top once there are results; on desktop it heads the sidebar. */}
      <header className="border-rule bg-panel order-0 flex items-center justify-between border-b px-4 py-3 md:hidden">
        <a href="/" className="flex items-center gap-2 text-[17px] font-extrabold">
          <Logo className="h-7 w-7" />
          WeatherRoute
        </a>
        {plan && <span className="text-ink-3 text-[13px]">Routes by {plan.provider}</span>}
      </header>
      <aside
        className={`${plan ? "order-2" : "order-1"} border-rule bg-panel flex w-full shrink-0 flex-col md:order-1 md:w-[430px] md:overflow-y-auto md:border-r`}
      >
        <header className="border-rule bg-panel sticky top-0 z-10 hidden items-center justify-between border-b px-5 py-3 md:flex">
          <a href="/" className="flex items-center gap-2 text-[17px] font-extrabold">
            <Logo className="h-7 w-7" />
            WeatherRoute
          </a>
          {plan && <span className="text-ink-3 text-[13px]">Routes by {plan.provider}</span>}
        </header>
        <div className="space-y-6 px-5 py-5">
          <div>
            <h1 className="text-[22px] leading-tight font-extrabold">Plan a trip</h1>
            <p className="text-ink-3 mt-1 text-[14px]">
              Three routes, each checked against the forecast for the hour the truck gets there.
            </p>
          </div>
          <TripForm loading={loading} onSubmit={search} />
          {error && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              <span>{error}</span>
              {request && (
                <button
                  type="button"
                  onClick={() => search(request)}
                  className="shrink-0 rounded-md border border-red-300 bg-white px-2 py-0.5 text-[13px] font-semibold hover:bg-red-100"
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
      {/* The map is the work surface; the forecast bar docks under it rather
          than covering it. Before the first search the form comes first on
          phones; after it, the map does. */}
      <main
        className={`${plan ? "order-1" : "order-2"} flex min-w-0 flex-col md:order-2 md:h-full md:flex-1`}
      >
        <div className="relative h-[56vh] min-h-[320px] md:h-auto md:min-h-0 md:flex-1">
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
            <div className="pointer-events-none absolute inset-x-0 top-5 flex justify-center px-4">
              <p className="border-rule text-ink-2 max-w-md rounded-md border bg-white px-4 py-2.5 text-center text-[14px] shadow-sm">
                Choose a start, destination and departure time. The routes and their weather appear
                here.
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
          <ForecastSlider
            routeLetter={selectedLetter}
            routeWorst={routeWorst}
            truck={truck}
            heatmap={heatmap}
            hour={hour}
            onChange={setHour}
            loading={heatLoading}
            error={heatError}
            onRetry={request && plan ? () => loadHeatmap(plan, request, latest.current) : undefined}
          />
        )}
      </main>
    </div>
  );
}

function MapLoading() {
  return (
    <div role="status" className="bg-paper/55 absolute inset-0 grid place-items-center">
      <div className="border-rule flex items-center gap-3 rounded-md border bg-white px-4 py-3 shadow-md">
        <span className="border-shield h-5 w-5 animate-spin rounded-full border-2 border-t-transparent motion-reduce:animate-none" />
        <span className="text-ink-2 text-[14px]">
          Finding 3 routes and reading the forecast at each checkpoint…
        </span>
      </div>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="border-rule border-t" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-rule space-y-2 border-b px-3 py-4">
          <div className="bg-rule-2 h-4 w-2/3 animate-pulse rounded" />
          <div className="bg-rule-2 h-2 w-full animate-pulse rounded" />
          <div className="bg-rule-2 h-3 w-1/2 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

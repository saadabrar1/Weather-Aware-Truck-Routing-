import { useRef, useState } from "react";
import { api, type Heatmap, type Plan, type PlanRequest } from "../api";
import ForecastSlider from "../components/ForecastSlider";
import Logo from "../components/Logo";
import MapView from "../components/MapView";
import RouteCards, { type CheckpointFocus } from "../components/RouteCards";
import TripForm from "../components/TripForm";

export default function Planner() {
  const [plan, setPlan] = useState<Plan | null>(null);
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

  const search = async (req: PlanRequest) => {
    const id = ++latest.current;
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
      setHeatLoading(true);
      try {
        const heat = await api.heatmap(result.corridor, req.departure, req.weight_lb);
        if (id === latest.current) setHeatmap(heat);
      } catch (e) {
        if (id === latest.current) setHeatError((e as Error).message);
      } finally {
        if (id === latest.current) setHeatLoading(false);
      }
    } catch (e) {
      if (id !== latest.current) return;
      setError((e as Error).message);
      setLoading(false);
    }
  };

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
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </p>
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
            heatmap={heatmap}
            hour={hour}
          />
          {!plan && !loading && (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center px-4">
              <p className="border-ink-600 bg-ink-900/85 rounded-full border px-4 py-2 text-center text-sm text-slate-300 backdrop-blur">
                Enter a trip to compare 3 routes by weather risk at the truck's arrival time
              </p>
            </div>
          )}
        </div>
        {plan && (
          <div className="border-ink-700 bg-ink-900 border-b p-2 md:absolute md:bottom-8 md:left-4 md:w-[440px] md:border-0 md:bg-transparent md:p-0">
            <ForecastSlider
              start={heatmap?.start ?? null}
              hours={heatmap?.hours ?? 49}
              hour={hour}
              onChange={setHour}
              loading={heatLoading}
              error={heatError}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="bg-ink-700/70 h-20 animate-pulse rounded-xl" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-ink-800 h-36 animate-pulse rounded-xl" />
      ))}
    </div>
  );
}

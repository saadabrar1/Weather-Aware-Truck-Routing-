import { useRef, useState } from "react";
import { api, type Heatmap, type Plan, type PlanRequest } from "../api";
import ForecastSlider from "../components/ForecastSlider";
import MapView from "../components/MapView";
import RouteCards from "../components/RouteCards";
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
  // Ignore responses from a search the user has already replaced.
  const latest = useRef(0);

  const search = async (req: PlanRequest) => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    setHeatmap(null);
    setHeatError(null);
    setHour(0);
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

  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="order-2 flex w-full shrink-0 flex-col overflow-y-auto border-slate-200 bg-slate-50 md:order-1 md:w-[400px] md:border-r">
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <a href="/" className="font-semibold tracking-tight">
            Weather-Aware Truck Routing
          </a>
          {plan && (
            <span className="text-[11px] text-slate-500">Routing: {plan.provider}</span>
          )}
        </header>
        <div className="space-y-4 p-4">
          <TripForm loading={loading} onSubmit={search} />
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
          {loading && <ResultsSkeleton />}
          {plan && !loading && (
            <RouteCards plan={plan} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </div>
      </aside>
      <main className="relative order-1 h-[55vh] min-h-[320px] flex-1 md:order-2 md:h-full">
        <MapView
          plan={plan}
          selectedId={selectedId}
          onSelect={setSelectedId}
          heatmap={heatmap}
          hour={hour}
        />
        {plan && (
          <div className="absolute inset-x-3 bottom-8 md:right-auto md:left-4 md:w-[420px]">
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
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200" />
      ))}
    </div>
  );
}

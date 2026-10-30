import {
  type ExpressionSpecification,
  type GeoJSONSource,
  LngLatBounds,
  Map as MapLibre,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
// MapLibre finds its worker next to its own module, which bundling moves.
// Point it at the worker file explicitly so dev and production builds agree.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef, useState } from "react";
import type { Checkpoint, Heatmap, Plan } from "../api";
import { LEVELS, ROUTE_LETTERS, formatTime } from "../risk";

setWorkerUrl(workerUrl);

const STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const levelColor: ExpressionSpecification = [
  "match",
  ["get", "level"],
  ...LEVELS.flatMap((l, i) => [i, l.color]),
  "#94a3b8",
] as unknown as ExpressionSpecification;

// Colour each corridor point by its risk level at the given forecast hour.
function heatColor(hour: number): ExpressionSpecification {
  return [
    "match",
    ["get", `h${hour}`],
    ...LEVELS.flatMap((l, i) => [i, l.color]),
    "rgba(0,0,0,0)",
  ] as unknown as ExpressionSpecification;
}

// Calm (Low) is the usual case, so it stays a faint wash and real risk stands out.
function heatOpacity(hour: number): ExpressionSpecification {
  return ["case", ["==", ["get", `h${hour}`], 0], 0.14, 0.32] as ExpressionSpecification;
}

type Props = {
  plan: Plan | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  heatmap: Heatmap | null;
  hour: number;
};

export default function MapView({ plan, selectedId, onSelect, heatmap, hour }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map and its layers once; later effects only swap data or paint values.
  useEffect(() => {
    const map = new MapLibre({
      container: container.current!,
      style: STYLE_URL,
      center: [-98.5, 39.5],
      zoom: 3.6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("heat", { type: "geojson", data: EMPTY });
      map.addSource("routes", { type: "geojson", data: EMPTY });
      map.addSource("checkpoints", { type: "geojson", data: EMPTY });

      // The heatmap is drawn as heavily blurred circles rather than a MapLibre
      // `heatmap` layer. A heatmap layer adds overlapping points together, so
      // a cluster of calm points would read as risk; here each point keeps the
      // colour of its own risk level and neighbours blend at the edges.
      map.addLayer({
        id: "heat",
        type: "circle",
        source: "heat",
        paint: {
          "circle-color": heatColor(0),
          // Points sit ~0.25° apart; the radius doubles per zoom level so the
          // blobs keep overlapping into one continuous corridor surface.
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 3, 7, 11, 1792],
          "circle-blur": 1,
          "circle-opacity": heatOpacity(0),
        },
      });
      map.addLayer({
        id: "routes-casing",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
        paint: { "line-color": "#ffffff", "line-width": ["case", ["get", "selected"], 9, 6] },
      });
      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
        paint: {
          "line-color": ["case", ["get", "selected"], "#1d4ed8", "#64748b"],
          "line-width": ["case", ["get", "selected"], 5, 3],
          "line-opacity": ["case", ["get", "selected"], 1, 0.7],
        },
      });
      map.addLayer({
        id: "checkpoints",
        type: "circle",
        source: "checkpoints",
        layout: { "circle-sort-key": ["get", "z"] },
        paint: {
          "circle-color": levelColor,
          "circle-radius": ["case", ["get", "selected"], 6, 4],
          "circle-opacity": ["case", ["get", "selected"], 1, 0.75],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      for (const layer of ["routes", "checkpoints"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
      map.on("click", "routes", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id != null) onSelectRef.current(String(id));
      });
      map.on("click", "checkpoints", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const cp = JSON.parse(f.properties.data) as Checkpoint;
        onSelectRef.current(String(f.properties.routeId));
        new Popup({ offset: 10, maxWidth: "260px" })
          .setLngLat([cp.lon, cp.lat])
          .setHTML(popupHtml(cp, String(f.properties.routeLetter)))
          .addTo(map);
      });
      setReady(true);
    });

    return () => map.remove();
  }, []);

  // Routes and checkpoints; the selected route draws on top.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const routes = plan?.routes ?? [];
    const letter = (id: string) => ROUTE_LETTERS[routes.findIndex((r) => r.id === id)];
    (map.getSource("routes") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: routes.map((r) => ({
        type: "Feature",
        properties: { id: r.id, selected: r.id === selectedId, z: r.id === selectedId ? 1 : 0 },
        geometry: { type: "LineString", coordinates: r.geometry },
      })),
    });
    (map.getSource("checkpoints") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: routes.flatMap((r) =>
        r.checkpoints.map((cp) => ({
          type: "Feature" as const,
          properties: {
            level: cp.level,
            routeId: r.id,
            routeLetter: letter(r.id),
            selected: r.id === selectedId,
            z: (r.id === selectedId ? 10 : 0) + cp.level,
            data: JSON.stringify(cp),
          },
          geometry: { type: "Point" as const, coordinates: [cp.lon, cp.lat] },
        })),
      ),
    });
  }, [plan, selectedId, ready]);

  // Frame all routes when a new plan arrives.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !plan) return;
    const bounds = new LngLatBounds();
    for (const r of plan.routes) for (const c of r.geometry) bounds.extend(c);
    const mobile = window.innerWidth < 768;
    map.fitBounds(bounds, { padding: mobile ? 32 : 64, duration: 800 });
  }, [plan, ready]);

  // Heatmap data: one feature per corridor point with every hour as a property,
  // so moving the slider never rebuilds or refetches anything.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("heat") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (heatmap?.points ?? []).map((p) => ({
        type: "Feature",
        properties: Object.fromEntries(p.risk.map((v, h) => [`h${h}`, v])),
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      })),
    });
  }, [heatmap, ready]);

  // The slider: a single paint-property change, rendered on the GPU.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const frame = requestAnimationFrame(() =>
      {
        map.setPaintProperty("heat", "circle-color", heatColor(hour));
        map.setPaintProperty("heat", "circle-opacity", heatOpacity(hour));
      },
    );
    return () => cancelAnimationFrame(frame);
  }, [hour, ready]);

  return <div ref={container} className="h-full w-full" aria-label="Route map" />;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function popupHtml(cp: Checkpoint, letter: string): string {
  const level = LEVELS[cp.level];
  const reasons = cp.reasons.length
    ? `<div class="mt-1 text-xs text-slate-600">${cp.reasons.map(escapeHtml).join("<br/>")}</div>`
    : "";
  return `
    <div class="text-sm">
      <div class="font-semibold">Route ${letter} · mile ${Math.round(cp.mile)}</div>
      <div class="text-slate-600">ETA ${escapeHtml(formatTime(cp.eta))}</div>
      <div class="mt-1 inline-flex items-center gap-1.5 font-medium">
        <span style="background:${level.color}" class="inline-block h-2.5 w-2.5 rounded-full"></span>
        ${level.label}
      </div>
      <div class="mt-1 text-xs text-slate-600">
        Wind ${cp.wind_mph} mph · Rain ${cp.rain_in_hr.toFixed(2)} in/hr · Snow ${cp.snow_in_hr.toFixed(2)} in/hr
      </div>
      ${reasons}
    </div>`;
}

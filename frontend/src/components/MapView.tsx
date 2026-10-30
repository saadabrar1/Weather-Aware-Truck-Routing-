import {
  type ExpressionSpecification,
  type GeoJSONSource,
  LngLatBounds,
  Map as MapLibre,
  Marker,
  Popup,
  setWorkerUrl,
} from "maplibre-gl";
// MapLibre finds its worker next to its own module, which bundling moves.
// Point it at the worker file explicitly so dev and production builds agree.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef, useState } from "react";
import type { Checkpoint, Heatmap, Plan, RouteOption } from "../api";
import { LEVELS, ROUTE_LETTERS, formatTime } from "../risk";
import type { CheckpointFocus } from "./RouteCards";

setWorkerUrl(workerUrl);

const STYLE_URL = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
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
  return ["case", ["==", ["get", `h${hour}`], 0], 0.11, 0.42] as ExpressionSpecification;
}

type Props = {
  plan: Plan | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  heatmap: Heatmap | null;
  hour: number;
  focus: CheckpointFocus;
};

export default function MapView({ plan, selectedId, onSelect, heatmap, hour, focus }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const markersRef = useRef<Marker[]>([]);
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
      map.addSource("focus", { type: "geojson", data: EMPTY });

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
      // A soft turquoise glow under the selected route only.
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "selected"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#40e0d0", "line-width": 16, "line-blur": 10, "line-opacity": 0.35 },
      });
      map.addLayer({
        id: "routes-casing",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
        paint: { "line-color": "#0b1014", "line-width": ["case", ["get", "selected"], 9, 6] },
      });
      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
        paint: {
          "line-color": ["case", ["get", "selected"], "#40e0d0", "#6b7f8a"],
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
          "circle-stroke-color": "#0b1014",
          "circle-stroke-width": 1.5,
        },
      });

      // Ring around the checkpoint hovered or chosen in the table.
      map.addLayer({
        id: "focus",
        type: "circle",
        source: "focus",
        paint: {
          "circle-radius": 11,
          "circle-color": "rgba(64,224,208,0.15)",
          "circle-stroke-color": "#40e0d0",
          "circle-stroke-width": 2.5,
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
        popupRef.current?.remove();
        popupRef.current = new Popup({ offset: 10, maxWidth: "260px", focusAfterOpen: false })
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

  // Route letters on the lines and origin/destination pins: five small DOM
  // markers, so the list and the map clearly name the same routes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    if (!plan) return;
    plan.routes.forEach((r, i) => {
      const el = routeLabel(ROUTE_LETTERS[i], r.id === plan.recommended_id, r.id === selectedId);
      el.addEventListener("click", () => onSelectRef.current(r.id));
      // Stagger labels along the routes so shared stretches don't stack them.
      const at = labelPoint(r, 0.32 + 0.18 * i);
      markersRef.current.push(new Marker({ element: el }).setLngLat(at).addTo(map));
    });
    const first = plan.routes[0].geometry;
    markersRef.current.push(
      new Marker({ element: endpoint("start") }).setLngLat(first[0]).addTo(map),
      new Marker({ element: endpoint("end") }).setLngLat(first[first.length - 1]).addTo(map),
    );
  }, [plan, selectedId, ready]);

  // Table hover highlights a checkpoint; a click also flies there and opens it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const cp = focus?.checkpoint;
    (map.getSource("focus") as GeoJSONSource).setData(
      cp
        ? {
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [cp.lon, cp.lat] },
          }
        : EMPTY,
    );
    if (cp && focus.fly && plan) {
      const letter = ROUTE_LETTERS[plan.routes.findIndex((r) => r.id === focus.routeId)];
      map.flyTo({ center: [cp.lon, cp.lat], zoom: Math.max(map.getZoom(), 8), duration: 700 });
      popupRef.current?.remove();
      popupRef.current = new Popup({ offset: 10, maxWidth: "260px", focusAfterOpen: false })
        .setLngLat([cp.lon, cp.lat])
        .setHTML(popupHtml(cp, letter))
        .addTo(map);
    }
  }, [focus, plan, ready]);

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
    const frame = requestAnimationFrame(() => {
      map.setPaintProperty("heat", "circle-color", heatColor(hour));
      map.setPaintProperty("heat", "circle-opacity", heatOpacity(hour));
    });
    return () => cancelAnimationFrame(frame);
  }, [hour, ready]);

  return <div ref={container} className="h-full w-full" aria-label="Route map" />;
}

function labelPoint(route: RouteOption, fraction: number): [number, number] {
  const g = route.geometry;
  return g[Math.min(g.length - 1, Math.floor(g.length * fraction))];
}

function routeLabel(letter: string, recommended: boolean, selected: boolean): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = letter;
  el.setAttribute("aria-label", `Select route ${letter}`);
  el.className = [
    "grid h-7 w-7 cursor-pointer place-items-center rounded-lg border-2 text-sm font-extrabold shadow-lg",
    recommended
      ? "border-ink-950 bg-turq text-ink-950"
      : "border-ink-950 bg-ink-600 text-slate-100",
    selected ? "ring-2 ring-turq ring-offset-2 ring-offset-ink-950" : "",
  ].join(" ");
  return el;
}

function endpoint(kind: "start" | "end"): HTMLElement {
  const el = document.createElement("div");
  el.title = kind === "start" ? "Origin" : "Destination";
  el.className =
    kind === "start"
      ? "h-4 w-4 rounded-full border-[3px] border-white bg-ink-950 shadow-lg"
      : "h-4 w-4 rotate-45 rounded-sm border-[3px] border-white bg-turq shadow-lg";
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function popupHtml(cp: Checkpoint, letter: string): string {
  const level = LEVELS[cp.level];
  const reasons = cp.reasons.length
    ? `<div class="mt-1 text-xs text-slate-400">${cp.reasons.map(escapeHtml).join("<br/>")}</div>`
    : "";
  return `
    <div class="text-sm">
      <div class="font-semibold">Route ${letter} · mile ${Math.round(cp.mile)}</div>
      <div class="text-slate-400">ETA ${escapeHtml(formatTime(cp.eta))}</div>
      <div class="mt-1 inline-flex items-center gap-1.5 font-medium">
        <span style="background:${level.color}" class="inline-block h-2.5 w-2.5 rounded-full"></span>
        ${level.label}
      </div>
      <div class="mt-1 text-xs text-slate-400">
        Wind ${cp.wind_mph} mph · Rain ${cp.rain_in_hr.toFixed(2)} in/hr · Snow ${cp.snow_in_hr.toFixed(2)} in/hr
      </div>
      ${reasons}
    </div>`;
}

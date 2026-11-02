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
import { shieldSvg } from "./Shield";

setWorkerUrl(workerUrl);

// Positron: a quiet light basemap, so the routes and risk colours carry the map.
const STYLE_URL = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const SHIELD_BLUE = "#1f4e9c";
const ALT_SLATE = "#6f7f91";
const INK = "#13253a";
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
  return ["case", ["==", ["get", `h${hour}`], 0], 0.06, 0.5] as ExpressionSpecification;
}

type Props = {
  plan: Plan | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  heatmap: Heatmap | null;
  hour: number;
  focus: CheckpointFocus;
  /** The selected route's truck at the slider hour, [lon, lat]. */
  truck: [number, number] | null;
  originLabel?: string;
  destinationLabel?: string;
};

export default function MapView({
  plan,
  selectedId,
  onSelect,
  heatmap,
  hour,
  focus,
  truck,
  originLabel,
  destinationLabel,
}: Props) {
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
      map.addSource("truck", { type: "geojson", data: EMPTY });

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
          // Points sit ~0.25° (~17 mi) apart. A radius of about twice that
          // spacing, doubling per zoom level, joins neighbours into one band
          // that follows the corridor instead of spilling far past it.
          "circle-radius": ["interpolate", ["exponential", 2], ["zoom"], 3, 5, 11, 1280],
          "circle-blur": 1,
          "circle-opacity": heatOpacity(0),
        },
      });
      // Colour says "recommended" (interstate blue) or "alternative" (grey); width and
      // a glow say "selected". The two never share a cue, so choosing an
      // alternative can't make it look recommended.
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "selected"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["case", ["get", "recommended"], SHIELD_BLUE, ALT_SLATE],
          "line-width": 16,
          "line-blur": 6,
          "line-opacity": 0.22,
        },
      });
      map.addLayer({
        id: "routes-casing",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
        paint: { "line-color": "#ffffff", "line-width": ["case", ["get", "selected"], 10, 6] },
      });
      map.addLayer({
        id: "routes",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round", "line-sort-key": ["get", "z"] },
        paint: {
          "line-color": ["case", ["get", "recommended"], SHIELD_BLUE, ALT_SLATE],
          "line-width": ["case", ["get", "selected"], 6, 3.5],
          "line-opacity": ["case", ["get", "selected"], 1, 0.85],
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

      // The truck at the slider hour: a halo and a white dot over the checkpoints.
      map.addLayer({
        id: "truck-halo",
        type: "circle",
        source: "truck",
        paint: { "circle-radius": 15, "circle-color": SHIELD_BLUE, "circle-opacity": 0.2 },
      });
      map.addLayer({
        id: "truck",
        type: "circle",
        source: "truck",
        paint: {
          "circle-radius": 7,
          "circle-color": INK,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });

      // Ring around the checkpoint hovered or chosen in the table.
      map.addLayer({
        id: "focus",
        type: "circle",
        source: "focus",
        paint: {
          "circle-radius": 11,
          "circle-color": "rgba(31,78,156,0.12)",
          "circle-stroke-color": SHIELD_BLUE,
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

    // Keep the canvas matched to its box when the layout around it changes.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container.current!);
    return () => {
      observer.disconnect();
      map.remove();
    };
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
        properties: {
          id: r.id,
          selected: r.id === selectedId,
          recommended: r.id === plan?.recommended_id,
          z: r.id === selectedId ? 1 : 0,
        },
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
    const start = first[0];
    const end = first[first.length - 1];
    // Labels point inward: the eastern endpoint's label hangs to its left, so it
    // never runs off the map edge or under the map key.
    const startIsEast = start[0] > end[0];
    markersRef.current.push(
      new Marker({ element: endpoint("start", originLabel, startIsEast) })
        .setLngLat(start)
        .addTo(map),
      new Marker({ element: endpoint("end", destinationLabel, !startIsEast) })
        .setLngLat(end)
        .addTo(map),
    );
  }, [plan, selectedId, ready, originLabel, destinationLabel]);

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

  // One point; updating it as the slider moves is a trivial GPU upload.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("truck") as GeoJSONSource).setData(
      truck
        ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: truck } }
        : EMPTY,
    );
  }, [truck, ready]);

  // Frame all routes when a new plan arrives.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !plan) return;
    // The forecast bar mounts under the map with the plan, so the map has just
    // got shorter; measure it again before fitting, or the fit overshoots.
    map.resize();
    const bounds = new LngLatBounds();
    for (const r of plan.routes) for (const c of r.geometry) bounds.extend(c);
    const mobile = window.innerWidth < 768;
    // Leave room on desktop for the map key (top right), the forecast panel
    // (bottom left) and the endpoint labels, so no route ends up underneath.
    map.fitBounds(bounds, {
      padding: mobile ? 40 : { top: 60, right: 280, bottom: 60, left: 80 },
      duration: 800,
    });
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

// Route shields on the lines; the selected one is drawn larger.
function routeLabel(letter: string, recommended: boolean, selected: boolean): HTMLElement {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", `Select route ${letter}`);
  el.className = "block cursor-pointer drop-shadow-[0_1px_1px_rgba(19,37,58,0.35)]";
  // Letters come from the fixed A/B/C list, never user input.
  el.innerHTML = shieldSvg(letter, recommended, selected ? 34 : 26);
  return el;
}

// The pin keeps the marker's anchor; the place name hangs to its right.
function endpoint(kind: "start" | "end", label?: string, labelLeft = false): HTMLElement {
  const role = kind === "start" ? "From" : "To";
  const el = document.createElement("div");
  el.className = "relative h-4 w-4";
  el.title = label ? `${role}: ${label}` : role;
  const pin = document.createElement("div");
  pin.className =
    kind === "start"
      ? "h-4 w-4 rounded-full border-[3px] border-ink bg-white shadow"
      : "h-3.5 w-3.5 rotate-45 rounded-[2px] border-2 border-white bg-ink shadow";
  const tag = document.createElement("div");
  tag.className = `pointer-events-none absolute top-1/2 ${labelLeft ? "right-6" : "left-6"} -translate-y-1/2 whitespace-nowrap rounded border border-rule bg-white px-1.5 py-0.5 text-[12px] text-ink shadow-sm`;
  // textContent, never innerHTML: the label is user-chosen text.
  // City and state: many US place names repeat across states (there is a Dallas
  // in Texas, Iowa, Missouri and Alabama), so the city alone can hide a wrong pick.
  const place = label
    ?.split(",")
    .slice(0, 2)
    .map((s) => s.trim())
    .join(", ");
  tag.textContent = place ? `${role} ${place}` : kind === "start" ? "Start" : "Destination";
  el.append(pin, tag);
  return el;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function popupHtml(cp: Checkpoint, letter: string): string {
  const level = LEVELS[cp.level];
  const reasons = cp.reasons.length
    ? `<div class="mt-1 text-xs text-ink-2">${cp.reasons.map(escapeHtml).join("<br/>")}</div>`
    : "";
  return `
    <div class="text-sm">
      <div class="font-bold">Route ${letter}, mile ${Math.round(cp.mile)}</div>
      <div class="text-ink-3">Truck arrives ${escapeHtml(formatTime(cp.eta))}</div>
      <div class="mt-1 inline-flex items-center gap-1.5 font-bold" style="color:${level.ink}">
        <span style="background:${level.color}" class="inline-block h-2.5 w-2.5 rounded-full"></span>
        ${level.label}
      </div>
      <table class="mt-1 text-xs text-ink-2"><tbody>
        <tr><td class="pr-3">Wind</td><td class="text-right">${cp.wind_mph} mph</td></tr>
        <tr><td class="pr-3">Rain</td><td class="text-right">${cp.rain_in_hr.toFixed(2)} in/hr</td></tr>
        <tr><td class="pr-3">Snow</td><td class="text-right">${cp.snow_in_hr.toFixed(2)} in/hr</td></tr>
      </tbody></table>
      ${reasons}
    </div>`;
}

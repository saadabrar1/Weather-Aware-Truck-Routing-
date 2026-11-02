// Small spherical helpers for the map. Coordinates are [lon, lat], as in GeoJSON.
import type { RouteOption } from "./api";

type LonLat = [number, number];

const EARTH_RADIUS_MI = 3958.7613;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMi(a: LonLat, b: LonLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

export function cumulativeMiles(line: LonLat[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + haversineMi(line[i - 1], line[i]));
  return out;
}

/** The point `mile` miles along `line`, following the road rather than cutting corners. */
export function pointAtMile(line: LonLat[], miles: number[], mile: number): LonLat {
  if (mile <= 0) return line[0];
  if (mile >= miles[miles.length - 1]) return line[line.length - 1];
  let lo = 0;
  let hi = miles.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (miles[mid] <= mile) lo = mid;
    else hi = mid;
  }
  const t = (mile - miles[lo]) / (miles[hi] - miles[lo] || 1);
  return [
    line[lo][0] + (line[hi][0] - line[lo][0]) * t,
    line[lo][1] + (line[hi][1] - line[lo][1]) * t,
  ];
}

export type TruckState =
  | { kind: "waiting" | "arrived"; at: LonLat }
  | { kind: "driving"; mile: number; totalMiles: number; at: LonLat };

/**
 * Where the truck is at `when`, from the route's own checkpoint ETAs: the mile
 * is interpolated in time between the two checkpoints around `when`, then
 * placed on the route geometry.
 */
export function truckAt(route: RouteOption, miles: number[], when: number): TruckState {
  const cps = route.checkpoints;
  const times = cps.map((c) => Date.parse(c.eta));
  if (when < times[0]) return { kind: "waiting", at: route.geometry[0] };
  if (when >= times[times.length - 1]) {
    return { kind: "arrived", at: route.geometry[route.geometry.length - 1] };
  }
  let i = 0;
  while (times[i + 1] <= when) i++;
  const t = (when - times[i]) / (times[i + 1] - times[i] || 1);
  const mile = cps[i].mile + (cps[i + 1].mile - cps[i].mile) * t;
  // Checkpoint miles come from the backend's own distance sums; scale them onto
  // this (simplified) geometry so the marker lands on the drawn line.
  const scale = miles[miles.length - 1] / (cps[cps.length - 1].mile || 1);
  return {
    kind: "driving",
    mile,
    totalMiles: cps[cps.length - 1].mile,
    at: pointAtMile(route.geometry, miles, mile * scale),
  };
}

/** Indices of `points` within `radiusMi` of the route line (checked against a thinned line). */
export function pointsNearRoute(
  points: { lon: number; lat: number }[],
  line: LonLat[],
  radiusMi: number,
): number[] {
  const step = Math.max(1, Math.floor(line.length / 400));
  const thin = line.filter((_, i) => i % step === 0);
  const out: number[] = [];
  points.forEach((p, i) => {
    const here: LonLat = [p.lon, p.lat];
    if (thin.some((q) => haversineMi(here, q) <= radiusMi)) out.push(i);
  });
  return out;
}

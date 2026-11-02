// Risk levels match backend/planner/core/risk.py (0 = Low … 4 = No Travel).
// `color` fills dots, strips and the map; `ink` is the same hue dark enough
// to read as text on white.
import type { RouteOption } from "./api";

export const LEVELS = [
  { key: "low", label: "Low", color: "#22a454", ink: "#157a3a" },
  { key: "moderate", label: "Moderate", color: "#e6b100", ink: "#8a6400" },
  { key: "high", label: "High", color: "#f0700f", ink: "#b24a00" },
  { key: "severe", label: "Severe", color: "#dc2a2a", ink: "#b01c1c" },
  { key: "no_travel", label: "No Travel", color: "#8b3fd9", ink: "#6d28b8" },
] as const;

export const ROUTE_LETTERS = ["A", "B", "C"];

// The worst conditions the truck meets anywhere on the route.
export function peakLevel(route: RouteOption): number {
  return Math.max(0, ...route.checkpoints.map((c) => c.level));
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

export function formatTime(iso: string | Date): string {
  return timeFormat.format(typeof iso === "string" ? new Date(iso) : iso);
}

// Table rows show the clock only; the zone is printed once in the column header.
const clockFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function formatClock(iso: string | Date): string {
  return clockFormat.format(typeof iso === "string" ? new Date(iso) : iso);
}

export function timeZoneLabel(iso: string): string {
  return (
    timeFormat.formatToParts(new Date(iso)).find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

// Risk levels match backend/planner/core/risk.py (0 = Low … 4 = No Travel).
import type { RouteOption } from "./api";

export const LEVELS = [
  { key: "low", label: "Low", color: "#22c55e" },
  { key: "moderate", label: "Moderate", color: "#eab308" },
  { key: "high", label: "High", color: "#f97316" },
  { key: "severe", label: "Severe", color: "#ef4444" },
  { key: "no_travel", label: "No Travel", color: "#a855f7" },
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

export function formatClock(iso: string): string {
  return clockFormat.format(new Date(iso));
}

export function timeZoneLabel(iso: string): string {
  return (
    timeFormat.formatToParts(new Date(iso)).find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

// Risk levels match backend/planner/core/risk.py (0 = Low … 4 = No Travel).

export const LEVELS = [
  { key: "low", label: "Low", color: "#22c55e" },
  { key: "moderate", label: "Moderate", color: "#eab308" },
  { key: "high", label: "High", color: "#f97316" },
  { key: "severe", label: "Severe", color: "#dc2626" },
  { key: "no_travel", label: "No Travel", color: "#7e22ce" },
] as const;

export const ROUTE_LETTERS = ["A", "B", "C"];

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

// Shapes returned by the Django API (backend/planner/planning.py).

export type Place = { label: string; lat: number; lon: number };

export type Checkpoint = {
  mile: number;
  lon: number;
  lat: number;
  eta: string;
  wind_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
  level: number;
  reasons: string[];
};

export type RouteOption = {
  id: string;
  rank: number;
  name: string;
  distance_mi: number;
  duration_s: number;
  avg_risk: number;
  miles_by_level: Record<"low" | "moderate" | "high" | "severe" | "no_travel", number>;
  geometry: [number, number][];
  checkpoints: Checkpoint[];
};

export type Plan = {
  provider: string;
  departure: string;
  interval_mi: number;
  recommended_id: string;
  explanation: string;
  warnings: string[];
  routes: RouteOption[];
  corridor: [number, number][];
};

export type Heatmap = {
  start: string;
  hours: number;
  points: { lon: number; lat: number; risk: number[] }[];
};

export type PlanRequest = {
  origin: Place;
  destination: Place;
  departure: string;
  weight_lb: number;
  interval_mi: number;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(errorMessage(body) ?? `Request failed (${res.status}).`);
  return body as T;
}

// DRF errors arrive as {detail} or {field: [messages]}; show the first readable one.
function errorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.detail === "string") return b.detail;
  for (const [field, value] of Object.entries(b)) {
    const msg = Array.isArray(value) ? value[0] : value;
    if (typeof msg === "string") {
      return field === "non_field_errors" ? msg : `${field.replace(/_/g, " ")}: ${msg}`;
    }
    if (msg && typeof msg === "object") return errorMessage(msg);
  }
  return null;
}

export const api = {
  geocode: (q: string, signal?: AbortSignal) =>
    request<Place[]>(`/api/geocode?q=${encodeURIComponent(q)}`, { signal }),
  plan: (body: PlanRequest) =>
    request<Plan>("/api/plan", { method: "POST", body: JSON.stringify(body) }),
  heatmap: (points: [number, number][], departure: string, weight_lb: number) =>
    request<Heatmap>("/api/heatmap", {
      method: "POST",
      body: JSON.stringify({ points, departure, weight_lb }),
    }),
};

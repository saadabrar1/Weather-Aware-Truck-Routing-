"""Turns a trip request into ranked route options and a corridor forecast."""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from planner.core.corridor import corridor_points
from planner.core.geo import LatLon, bearing_deg, cumulative_miles, destination, haversine_mi
from planner.core.ranking import explain, rank, summarize
from planner.core.risk import Risk, assess
from planner.core.sampling import locate, sample_checkpoints
from planner.services.http import UpstreamError
from planner.services.routing import Route, get_provider
from planner.services.weather import fetch_forecast, hour_floor

log = logging.getLogger(__name__)

ROUTE_COUNT = 3
HEATMAP_HOURS = 48
# A forced alternative that is mostly the same road, or a big detour, isn't a real option.
MAX_SHARED_FRACTION = 0.85
MAX_DETOUR_RATIO = 1.6


def plan_trip(
    origin: LatLon, dest: LatLon, departure: datetime, weight_lb: float, interval_mi: int
) -> dict:
    started = time.monotonic()
    provider = get_provider()
    routes, warnings = _three_routes(provider, origin, dest, departure, weight_lb)

    routed = time.monotonic()
    sampled = [
        sample_checkpoints(r.coords, r.segment_seconds, departure, interval_mi) for r in routes
    ]
    all_points = [(c.lat, c.lon) for cps in sampled for c in cps]
    last_eta = max(c.eta for cps in sampled for c in cps)
    forecast = fetch_forecast(all_points, departure, last_eta)
    log.info(
        "plan via %s: %d routes in %.1fs, %d checkpoint forecasts in %.1fs",
        provider.name,
        len(routes),
        routed - started,
        len(all_points),
        time.monotonic() - routed,
    )

    options = []
    for idx, (route, cps) in enumerate(zip(routes, sampled, strict=True)):
        weather = [forecast.at((c.lat, c.lon), c.eta) for c in cps]
        assessed = [assess(w, weight_lb) for w in weather]
        risk = summarize(
            str(idx), route.distance_mi, route.duration_s, cps, [a.level for a in assessed]
        )
        options.append((route, cps, assessed, weather, risk))

    ranked = rank([o[4] for o in options])
    order = {r.route_id: i for i, r in enumerate(ranked)}
    best = ranked[0]
    if best.miles_by_level[Risk.NO_TRAVEL] > 0:
        warnings.append("Every route crosses No Travel conditions. Consider a later departure.")

    return {
        "provider": provider.name,
        "departure": departure.isoformat(),
        "interval_mi": interval_mi,
        "recommended_id": best.route_id,
        "explanation": explain(ranked),
        "warnings": warnings,
        "routes": [
            _route_payload(route, cps, assessed, weather, risk, order[risk.route_id])
            for route, cps, assessed, weather, risk in options
        ],
        "corridor": [[lon, lat] for lat, lon in corridor_points([r.coords for r in routes])],
    }


def corridor_forecast(points: list[LatLon], departure: datetime, weight_lb: float) -> dict:
    """Risk level at every corridor point for each hour 0–48 after departure."""
    start = hour_floor(departure)
    forecast = fetch_forecast(points, start, start + timedelta(hours=HEATMAP_HOURS))
    return {
        "start": start.isoformat(),
        "hours": HEATMAP_HOURS + 1,
        "points": [
            {
                "lon": p[1],
                "lat": p[0],
                "risk": [int(assess(w, weight_lb).level) for w in forecast.hourly(p)],
            }
            for p in points
        ],
    }


def _three_routes(provider, origin, dest, departure, weight_lb) -> tuple[list[Route], list[str]]:
    """The provider's own alternatives first. When it offers fewer than three
    distinct ones, force more through a via point to either side of the
    fastest route's midpoint."""
    candidates = provider.routes(origin, dest, departure, weight_lb)
    if not candidates:
        raise UpstreamError("No route found between those places.")
    fastest = min(candidates, key=lambda r: r.duration_s)
    routes: list[Route] = []
    for r in sorted(candidates, key=lambda r: r.duration_s):
        _add_if_distinct(routes, r, fastest)

    if len(routes) < ROUTE_COUNT:

        def via_route(via: LatLon) -> Route | None:
            try:
                forced = provider.routes(origin, dest, departure, weight_lb, via=via)
            except UpstreamError as exc:
                log.info("via-point alternative failed: %s", exc)
                return None
            return forced[0] if forced else None

        # Requested together, then considered in order, so the result is the
        # same as asking one at a time.
        with ThreadPoolExecutor(max_workers=4) as pool:
            forced_routes = list(pool.map(via_route, _via_points(fastest)))
        for forced in forced_routes:
            if forced and len(routes) < ROUTE_COUNT:
                _add_if_distinct(routes, forced, fastest)

    warnings = []
    if len(routes) < ROUTE_COUNT:
        warnings.append(f"Only {len(routes)} distinct route(s) exist between these places.")
    return routes[:ROUTE_COUNT], warnings


def _via_points(route: Route) -> list[LatLon]:
    miles = cumulative_miles(route.coords)
    zeros = [0.0] * len(route.coords)
    total = miles[-1]
    lat, lon, _ = locate(total / 2, route.coords, miles, zeros)
    a = locate(max(total / 2 - 5, 0), route.coords, miles, zeros)
    b = locate(min(total / 2 + 5, total), route.coords, miles, zeros)
    heading = bearing_deg(a[:2], b[:2])
    # Push the via point sideways by a share of the trip, within sane limits.
    points = []
    for share in (0.12, 0.25):
        offset = min(max(total * share, 10), 120)
        for side in (90, -90):
            points.append(destination((lat, lon), heading + side, offset))
    return points


def _add_if_distinct(routes: list[Route], candidate: Route, fastest: Route) -> None:
    if candidate.duration_s > fastest.duration_s * MAX_DETOUR_RATIO:
        return
    if all(_shared_fraction(candidate, r) < MAX_SHARED_FRACTION for r in routes):
        routes.append(candidate)


def _shared_fraction(a: Route, b: Route) -> float:
    """Share of route `a` (sampled) lying within a mile of route `b`."""
    sample = _thin(a.coords, 60)
    other = _thin(b.coords, 600)
    near = sum(1 for p in sample if min(haversine_mi(p, q) for q in other) < 1.0)
    return near / len(sample)


def _thin(coords: list[LatLon], n: int) -> list[LatLon]:
    step = max(1, len(coords) // n)
    return coords[::step]


def _simplify(coords: list[LatLon], min_gap_mi: float = 0.1, cap: int = 2500) -> list[list[float]]:
    """Fewer vertices for the map: drop points closer than `min_gap_mi` to the last kept one."""
    kept = [coords[0]]
    for p in coords[1:-1]:
        if haversine_mi(kept[-1], p) >= min_gap_mi:
            kept.append(p)
    kept.append(coords[-1])
    if len(kept) > cap:
        kept = kept[:: len(kept) // cap + 1] + [coords[-1]]
    return [[round(lon, 5), round(lat, 5)] for lat, lon in kept]


def _route_payload(route, cps, assessed, weather, risk, position) -> dict:
    return {
        "id": risk.route_id,
        "rank": position + 1,
        "name": route.name,
        "distance_mi": round(route.distance_mi, 1),
        "duration_s": round(route.duration_s),
        "avg_risk": round(risk.avg_risk, 2),
        "miles_by_level": {
            level.name.lower(): round(m, 1) for level, m in risk.miles_by_level.items()
        },
        "geometry": _simplify(route.coords),
        "checkpoints": [
            {
                "mile": c.mile,
                "lon": round(c.lon, 5),
                "lat": round(c.lat, 5),
                "eta": c.eta.replace(microsecond=0).isoformat(),
                "wind_mph": round(w.wind_mph, 1),
                "rain_in_hr": round(w.rain_in_hr, 3),
                "snow_in_hr": round(w.snow_in_hr, 3),
                "level": int(a.level),
                "reasons": a.reasons,
            }
            for c, a, w in zip(cps, assessed, weather, strict=True)
        ],
    }

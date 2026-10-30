"""Grid of forecast points covering the band of land around the candidate routes."""

from __future__ import annotations

from .geo import LatLon, bearing_deg, cumulative_miles, destination
from .sampling import locate

STEP_MI = 20.0
OFFSETS_MI = (-25.0, 0.0, 25.0)
# Forecast models resolve roughly 0.1–0.25°, so finer points add requests, not
# detail. Open-Meteo bills each location as one call (600/min, 5,000/h free),
# so the grid stays coarse and the map's heatmap blur fills between points.
SNAP_DEG = 0.25
MAX_POINTS = 250


def corridor_points(routes: list[list[LatLon]]) -> list[LatLon]:
    """Points every STEP_MI along each route, repeated at perpendicular offsets,
    snapped to a grid and de-duplicated. The step widens until the set fits
    under MAX_POINTS, so a cross-country trip stays one quick request."""
    step = STEP_MI
    while True:
        points = _build(routes, step)
        if len(points) <= MAX_POINTS:
            return points
        step *= 1.25


def _build(routes: list[list[LatLon]], step: float) -> list[LatLon]:
    seen: dict[tuple[int, int], LatLon] = {}
    for coords in routes:
        if len(coords) < 2:
            continue
        miles = cumulative_miles(coords)
        zeros = [0.0] * len(coords)
        mark = 0.0
        while mark <= miles[-1]:
            lat, lon, _ = locate(mark, coords, miles, zeros)
            ahead_lat, ahead_lon, _ = locate(min(mark + 1, miles[-1]), coords, miles, zeros)
            heading = bearing_deg((lat, lon), (ahead_lat, ahead_lon))
            for offset in OFFSETS_MI:
                p = (lat, lon) if offset == 0 else destination((lat, lon), heading + 90, offset)
                key = (round(p[0] / SNAP_DEG), round(p[1] / SNAP_DEG))
                seen.setdefault(key, (round(key[0] * SNAP_DEG, 4), round(key[1] * SNAP_DEG, 4)))
            mark += step
    return list(seen.values())

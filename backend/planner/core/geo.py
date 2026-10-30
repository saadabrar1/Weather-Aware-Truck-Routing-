"""Spherical geometry helpers. Coordinates are (lat, lon) tuples in degrees."""

from __future__ import annotations

import math

EARTH_RADIUS_MI = 3958.7613

LatLon = tuple[float, float]


def haversine_mi(a: LatLon, b: LatLon) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(h))


def bearing_deg(a: LatLon, b: LatLon) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def destination(origin: LatLon, bearing: float, distance_mi: float) -> LatLon:
    """Point reached travelling `distance_mi` from `origin` on initial `bearing`."""
    lat1, lon1 = map(math.radians, origin)
    brg = math.radians(bearing)
    d = distance_mi / EARTH_RADIUS_MI
    lat2 = math.asin(math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brg))
    lon2 = lon1 + math.atan2(
        math.sin(brg) * math.sin(d) * math.cos(lat1),
        math.cos(d) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), (math.degrees(lon2) + 540) % 360 - 180


def lerp(a: LatLon, b: LatLon, t: float) -> LatLon:
    # Linear interpolation is accurate enough between consecutive polyline
    # vertices, which are rarely more than a few miles apart.
    return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t


def cumulative_miles(coords: list[LatLon]) -> list[float]:
    out = [0.0]
    for prev, cur in zip(coords, coords[1:], strict=False):
        out.append(out[-1] + haversine_mi(prev, cur))
    return out

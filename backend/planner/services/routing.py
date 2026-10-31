"""Route providers. Both return routes as coordinates plus a travel time per
segment, which is what checkpoint ETAs are built from."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import flexpolyline
from django.conf import settings

from planner.core.geo import LatLon, haversine_mi

from .http import UpstreamError, get_json

METERS_PER_MI = 1609.344
KG_PER_LB = 0.45359237


@dataclass(frozen=True)
class Route:
    coords: list[LatLon]
    segment_seconds: list[float]
    distance_mi: float
    duration_s: float
    name: str = ""


class HereRouting:
    """HERE Routing v8 in truck mode: roads, restrictions and speeds suited to
    the truck's gross weight, and up to two alternatives per request."""

    name = "HERE"

    def routes(
        self,
        origin: LatLon,
        dest: LatLon,
        departure: datetime,
        weight_lb: float,
        via: LatLon | None = None,
        alternatives: int = 2,
    ) -> list[Route]:
        params = {
            "transportMode": "truck",
            "origin": f"{origin[0]},{origin[1]}",
            "destination": f"{dest[0]},{dest[1]}",
            "return": "polyline,summary",
            "spans": "duration",
            "alternatives": alternatives,
            "departureTime": departure.isoformat(),
            "vehicle[grossWeight]": round(weight_lb * KG_PER_LB),
            "apiKey": settings.HERE_API_KEY,
        }
        if via:
            params["via"] = f"{via[0]},{via[1]}!passThrough=true"
        # A via request is an optional forced alternative: try once, quickly.
        data = get_json(
            "https://router.hereapi.com/v8/routes",
            params,
            provider="HERE routing",
            quick=via is not None,
        )
        return [self._parse(r) for r in data.get("routes", [])]

    @staticmethod
    def _parse(route: dict) -> Route:
        coords: list[LatLon] = []
        seconds: list[float] = []
        for section in route["sections"]:
            pts = [(p[0], p[1]) for p in flexpolyline.decode(section["polyline"])]
            secs = _spread_spans(pts, section.get("spans", []), section["summary"]["duration"])
            if coords and pts and coords[-1] == pts[0]:
                pts = pts[1:]  # sections share their joining point
            elif coords and pts:
                secs = [0.0, *secs]
            coords.extend(pts)
            seconds.extend(secs)
        distance_m = sum(s["summary"]["length"] for s in route["sections"])
        duration_s = sum(s["summary"]["duration"] for s in route["sections"])
        return Route(coords, seconds, distance_m / METERS_PER_MI, duration_s)


def _spread_spans(pts: list[LatLon], spans: list[dict], total_s: float) -> list[float]:
    """Per-segment seconds from HERE spans (each covers polyline[offset:next_offset]).

    A span's time is shared among its segments by length. With no spans the
    section's total time is shared the same way across the whole section."""
    n = len(pts) - 1
    if n <= 0:
        return []
    bounds = [(s["offset"], s.get("duration", 0)) for s in spans] or [(0, total_s)]
    out = [0.0] * n
    for i, (start, dur) in enumerate(bounds):
        end = bounds[i + 1][0] if i + 1 < len(bounds) else n
        lengths = [haversine_mi(pts[j], pts[j + 1]) for j in range(start, end)]
        total_len = sum(lengths) or 1.0
        for j, length in zip(range(start, end), lengths, strict=True):
            out[j] = dur * length / total_len
    return out


class OsrmRouting:
    """Keyless fallback on the public OSRM server (car profile, no truck rules)."""

    name = "OSRM"

    def routes(
        self,
        origin: LatLon,
        dest: LatLon,
        departure: datetime,
        weight_lb: float,
        via: LatLon | None = None,
        alternatives: int = 2,
    ) -> list[Route]:
        stops = [origin, via, dest] if via else [origin, dest]
        path = ";".join(f"{p[1]},{p[0]}" for p in stops)
        data = get_json(
            f"{settings.OSRM_URL}/route/v1/driving/{path}",
            {
                "alternatives": "false" if via else str(alternatives),
                "overview": "full",
                "geometries": "geojson",
                "annotations": "duration",
            },
            provider="OSRM routing",
            quick=via is not None,
        )
        if data.get("code") != "Ok":
            raise UpstreamError(data.get("message") or "No route found between those places.")
        return [self._parse(r) for r in data["routes"]]

    @staticmethod
    def _parse(route: dict) -> Route:
        coords = [(lat, lon) for lon, lat in route["geometry"]["coordinates"]]
        seconds = [d for leg in route["legs"] for d in leg["annotation"]["duration"]]
        if len(seconds) != len(coords) - 1:
            # Leg joins can repeat a vertex; fall back to sharing time by length.
            seconds = _spread_spans(coords, [], route["duration"])
        name = " / ".join(leg["summary"] for leg in route["legs"] if leg.get("summary"))
        return Route(coords, seconds, route["distance"] / METERS_PER_MI, route["duration"], name)


# Geoapify's truck profiles are classes by maximum gross weight, in tonnes.
GEOAPIFY_TRUCK_CLASSES = (
    (3.5, "light_truck"),
    (7.5, "medium_truck"),
    (22.0, "truck"),
)
KG_PER_TONNE = 1000


def geoapify_mode(weight_lb: float) -> str:
    """The lightest Geoapify truck class that can carry the load (heavy_truck above 22 t)."""
    tonnes = weight_lb * KG_PER_LB / KG_PER_TONNE
    for limit, mode in GEOAPIFY_TRUCK_CLASSES:
        if tonnes <= limit:
            return mode
    return "heavy_truck"


class GeoapifyRouting:
    """Geoapify Routing with a truck profile picked from the load's gross weight.

    It returns a single route per request; the planner forces the other two
    through via points, as it does for OSRM."""

    name = "Geoapify"

    def routes(
        self,
        origin: LatLon,
        dest: LatLon,
        departure: datetime,
        weight_lb: float,
        via: LatLon | None = None,
        alternatives: int = 2,
    ) -> list[Route]:
        stops = [origin, via, dest] if via else [origin, dest]
        data = get_json(
            "https://api.geoapify.com/v1/routing",
            {
                "waypoints": "|".join(f"{p[0]},{p[1]}" for p in stops),
                "mode": geoapify_mode(weight_lb),
                # A via point only steers the route; it isn't a stop.
                "intermediate_waypoint_mode": "pass_through",
                "apiKey": settings.GEOAPIFY_API_KEY,
            },
            provider="Geoapify routing",
            quick=via is not None,
        )
        features = data.get("features") or []
        if not features:
            raise UpstreamError("No route found between those places.")
        return [self._parse(f) for f in features]

    @staticmethod
    def _parse(feature: dict) -> Route:
        """Geometry is one [lon, lat] line per leg; each leg's steps carry their
        time and the point range they cover, which play the part of HERE's spans."""
        coords: list[LatLon] = []
        seconds: list[float] = []
        lines = feature["geometry"]["coordinates"]
        legs = feature["properties"].get("legs") or [{}] * len(lines)
        for line, leg in zip(lines, legs, strict=True):
            pts = [(lat, lon) for lon, lat in line]
            spans = [
                {"offset": st["from_index"], "duration": st["time"]} for st in leg.get("steps", [])
            ]
            secs = _spread_spans(pts, spans, leg.get("time", 0))
            if coords and pts and coords[-1] == pts[0]:
                pts = pts[1:]  # legs share their joining point
            elif coords and pts:
                secs = [0.0, *secs]
            coords.extend(pts)
            seconds.extend(secs)
        props = feature["properties"]
        return Route(coords, seconds, props["distance"] / METERS_PER_MI, props["time"])


def get_provider():
    if settings.HERE_API_KEY:
        return HereRouting()
    if settings.GEOAPIFY_API_KEY:
        return GeoapifyRouting()
    return OsrmRouting()

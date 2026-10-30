"""Hourly forecasts from Open-Meteo, batched and cached per location."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from django.conf import settings
from django.core.cache import cache

from planner.core.geo import LatLon
from planner.core.risk import Weather

from .http import UpstreamError, get_json

MM_PER_IN = 25.4
CM_PER_IN = 2.54
# Open-Meteo accepts many coordinates per call; this keeps URLs well under limits.
BATCH = 50
# Forecast cells are ~0.1° (about 7 mi), so nearby points share one series.
GRID_DEG = 0.1

HOURLY = "wind_speed_10m,rain,showers,snowfall"


def hour_floor(t: datetime) -> datetime:
    return t.replace(minute=0, second=0, microsecond=0)


def snap(p: LatLon) -> LatLon:
    return round(round(p[0] / GRID_DEG) * GRID_DEG, 4), round(round(p[1] / GRID_DEG) * GRID_DEG, 4)


class Forecast:
    """Hourly weather series for a set of points, from `start` for `hours` hours."""

    def __init__(self, start: datetime, series: dict[LatLon, list[Weather]]):
        self.start = start
        self._series = series

    def at(self, point: LatLon, when: datetime) -> Weather:
        series = self._series[snap(point)]
        # Nearest forecast hour to the truck's arrival time.
        index = round((when - self.start).total_seconds() / 3600)
        return series[min(max(index, 0), len(series) - 1)]

    def hourly(self, point: LatLon) -> list[Weather]:
        return self._series[snap(point)]


def fetch_forecast(points: list[LatLon], start: datetime, end: datetime) -> Forecast:
    """Forecast for every point from the hour containing `start` through `end`."""
    start = hour_floor(start)
    hours = int((hour_floor(end) - start).total_seconds() // 3600) + 1
    cells = list(dict.fromkeys(snap(p) for p in points))
    keys = {c: f"wx:{c[0]}:{c[1]}:{start:%Y%m%d%H}:{hours}" for c in cells}

    cached = cache.get_many(list(keys.values()))
    series = {c: cached[k] for c, k in keys.items() if k in cached}
    missing = [c for c in cells if c not in series]

    batches = [missing[i : i + BATCH] for i in range(0, len(missing), BATCH)]
    with ThreadPoolExecutor(max_workers=6) as pool:
        for fetched in pool.map(lambda b: _fetch_batch(b, start, hours), batches):
            series.update(fetched)
            cache.set_many({keys[c]: s for c, s in fetched.items()})
    return Forecast(start, series)


def _fetch_batch(cells: list[LatLon], start: datetime, hours: int) -> dict[LatLon, list[Weather]]:
    end = start + timedelta(hours=hours - 1)
    data = get_json(
        f"{settings.OPEN_METEO_URL}/v1/forecast",
        {
            "latitude": ",".join(str(c[0]) for c in cells),
            "longitude": ",".join(str(c[1]) for c in cells),
            "hourly": HOURLY,
            "wind_speed_unit": "mph",
            "timezone": "GMT",
            "start_hour": start.strftime("%Y-%m-%dT%H:%M"),
            "end_hour": end.strftime("%Y-%m-%dT%H:%M"),
        },
        provider="Open-Meteo",
    )
    # A single location comes back as an object, several as a list.
    results = data if isinstance(data, list) else [data]
    if len(results) != len(cells):
        raise UpstreamError("Open-Meteo returned an unexpected number of locations.")
    return {cell: _to_weather(r["hourly"], hours) for cell, r in zip(cells, results, strict=True)}


def _to_weather(hourly: dict, hours: int) -> list[Weather]:
    def col(name: str) -> list[float]:
        # Missing values (null) far out in the forecast count as calm/dry.
        return [v or 0.0 for v in hourly.get(name, [])][:hours]

    wind, rain, showers, snow = (col(n) for n in HOURLY.split(","))
    if len(wind) < hours:
        raise UpstreamError("Open-Meteo has no forecast that far ahead.")
    return [
        Weather(
            wind_mph=wind[i],
            # Hourly totals are rates over that hour. Showers are convective
            # rain that `rain` alone leaves out.
            rain_in_hr=(rain[i] + showers[i]) / MM_PER_IN,
            snow_in_hr=snow[i] / CM_PER_IN,
        )
        for i in range(hours)
    ]

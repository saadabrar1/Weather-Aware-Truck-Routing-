from datetime import UTC, datetime

import flexpolyline
import pytest
import responses
from django.core.cache import cache

from planner.core.corridor import MAX_POINTS, corridor_points
from planner.core.geo import destination
from planner.services import weather
from planner.services.routing import HereRouting

START = datetime(2026, 11, 2, 8, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _clean():
    cache.clear()


@responses.activate
def test_weather_converts_mm_and_cm_to_inches_and_adds_showers():
    responses.add(
        responses.GET,
        "https://api.open-meteo.com/v1/forecast",
        json={
            "hourly": {
                "wind_speed_10m": [30.0, None],
                "rain": [2.54, 0.0],
                "showers": [2.54, 0.0],
                "snowfall": [5.08, 0.0],
            }
        },
    )
    fc = weather.fetch_forecast([(40.0, -105.0)], START, START.replace(hour=9))
    w = fc.at((40.0, -105.0), START)
    assert w.wind_mph == 30
    assert w.rain_in_hr == pytest.approx(0.2)
    assert w.snow_in_hr == pytest.approx(2.0)
    # Null values count as calm.
    assert fc.at((40.0, -105.0), START.replace(hour=9)).wind_mph == 0


@responses.activate
def test_weather_is_cached_per_location():
    body = {"hourly": {k: [1.0] for k in ("wind_speed_10m", "rain", "showers", "snowfall")}}
    responses.add(responses.GET, "https://api.open-meteo.com/v1/forecast", json=body)
    weather.fetch_forecast([(40.0, -105.0)], START, START)
    weather.fetch_forecast([(40.01, -105.01)], START, START)  # same 0.1° cell
    assert len(responses.calls) == 1


def test_forecast_picks_nearest_hour():
    hourly = [weather.Weather(i, 0, 0) for i in range(3)]
    fc = weather.Forecast(START, {(40.0, -105.0): hourly})
    assert fc.at((40.0, -105.0), START.replace(minute=29)).wind_mph == 0
    assert fc.at((40.0, -105.0), START.replace(minute=31)).wind_mph == 1


def test_here_route_parsing_spreads_span_durations_by_length():
    pts = [(40.0, -105.0), (40.0, -104.9), (40.0, -104.7), (40.0, -104.6)]
    route = {
        "sections": [
            {
                "polyline": flexpolyline.encode(pts),
                "summary": {"duration": 900, "length": 25_000},
                "spans": [{"offset": 0, "duration": 300}, {"offset": 2, "duration": 600}],
            }
        ]
    }
    parsed = HereRouting._parse(route)
    assert len(parsed.coords) == 4
    # Span one covers a 0.1° and a 0.2° segment, so its 300 s splits 1:2.
    assert parsed.segment_seconds == pytest.approx([100, 200, 600], rel=1e-3)
    assert parsed.duration_s == 900


def test_corridor_is_capped_for_long_trips():
    coast_to_coast = [(40.0, -120.0)]
    for _ in range(2500):
        coast_to_coast.append(destination(coast_to_coast[-1], 90, 1.0))
    pts = corridor_points([coast_to_coast])
    assert 0 < len(pts) <= MAX_POINTS

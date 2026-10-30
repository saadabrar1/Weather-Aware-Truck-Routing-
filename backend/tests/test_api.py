"""End-to-end through the API with routing and weather mocked at the HTTP layer."""

import json
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pytest
import responses
from django.core.cache import cache
from rest_framework.test import APIClient

from planner.core.geo import destination

DEPART = (datetime.now(UTC) + timedelta(hours=3)).replace(minute=0, second=0, microsecond=0)
ORIGIN = {"label": "Denver", "lat": 39.74, "lon": -104.99}
DEST = {"label": "Cheyenne", "lat": 41.14, "lon": -104.82}


@pytest.fixture(autouse=True)
def _clean(settings):
    settings.HERE_API_KEY = ""
    settings.ALLOWED_HOSTS = ["testserver"]
    cache.clear()


@pytest.fixture
def client():
    return APIClient()


def osrm_route(bearing: float, hours: float):
    """A 100-mile route leaving Denver on `bearing`, one vertex per mile."""
    pts = [(39.74, -104.99)]
    for _ in range(100):
        pts.append(destination(pts[-1], bearing, 1.0))
    return {
        "geometry": {"coordinates": [[lon, lat] for lat, lon in pts]},
        "legs": [{"summary": "", "annotation": {"duration": [hours * 36.0] * 100}}],
        "distance": 160_934.4,
        "duration": hours * 3600,
    }


def weather_callback(wind_for_lon):
    def callback(request):
        q = parse_qs(urlparse(request.url).query)
        lats = q["latitude"][0].split(",")
        lons = q["longitude"][0].split(",")
        start = datetime.fromisoformat(q["start_hour"][0])
        end = datetime.fromisoformat(q["end_hour"][0])
        hours = int((end - start).total_seconds() // 3600) + 1
        body = [
            {
                "hourly": {
                    "wind_speed_10m": [wind_for_lon(float(lon))] * hours,
                    "rain": [0.0] * hours,
                    "showers": [0.0] * hours,
                    "snowfall": [0.0] * hours,
                }
            }
            for _lat, lon in zip(lats, lons, strict=True)
        ]
        return 200, {}, json.dumps(body if len(body) > 1 else body[0])

    return callback


def mock_providers(routes, wind_for_lon=lambda lon: 5.0):
    responses.add(
        responses.GET,
        re.compile(r"https://router\.project-osrm\.org/route/v1/driving/[^;]+;[^;]+$"),
        json={"code": "Ok", "routes": routes},
    )
    # Forced alternatives through a via point (three coordinates in the path).
    responses.add(
        responses.GET,
        re.compile(r"https://router\.project-osrm\.org/route/v1/driving/[^;]+;[^;]+;[^;]+$"),
        json={"code": "Ok", "routes": [osrm_route(60, 2.2)]},
    )
    responses.add_callback(
        responses.GET,
        "https://api.open-meteo.com/v1/forecast",
        callback=weather_callback(wind_for_lon),
    )


def plan(client, **overrides):
    body = {
        "origin": ORIGIN,
        "destination": DEST,
        "departure": DEPART.isoformat(),
        "weight_lb": 35_000,
        "interval_mi": 25,
        **overrides,
    }
    return client.post("/api/plan", body, format="json")


@responses.activate
def test_plan_returns_three_ranked_routes(client):
    mock_providers([osrm_route(0, 2.0), osrm_route(30, 2.1), osrm_route(-30, 2.5)])
    res = plan(client)
    assert res.status_code == 200
    data = res.json()
    assert len(data["routes"]) == 3
    assert sorted(r["rank"] for r in data["routes"]) == [1, 2, 3]
    # Calm everywhere, so the fastest route wins on time.
    best = next(r for r in data["routes"] if r["id"] == data["recommended_id"])
    assert best["duration_s"] == 7200
    cps = best["checkpoints"]
    assert [c["mile"] for c in cps][:3] == [0, 25, 50]
    assert datetime.fromisoformat(cps[1]["eta"]) == DEPART + timedelta(minutes=30)
    assert data["corridor"]


@responses.activate
def test_load_rule_steers_recommendation_away_from_wind(client):
    # 47 mph east of -104.95: No Travel for a 35,000 lb truck on routes heading east.
    def wind(lon):
        return 47.0 if lon > -104.95 else 5.0

    mock_providers([osrm_route(45, 2.0), osrm_route(-20, 2.6), osrm_route(-40, 2.7)], wind)
    data = plan(client).json()
    best = next(r for r in data["routes"] if r["id"] == data["recommended_id"])
    assert best["miles_by_level"]["no_travel"] == 0
    windy = next(r for r in data["routes"] if r["miles_by_level"]["no_travel"] > 0)
    assert windy["rank"] == 3 or windy["duration_s"] == 7200
    assert any("35,000 lb" in reason for c in windy["checkpoints"] for reason in c["reasons"])


@responses.activate
def test_forces_alternatives_when_provider_returns_one(client):
    mock_providers([osrm_route(0, 2.0)])
    data = plan(client).json()
    # The via-point route is the same every time here, so only two are distinct.
    assert len(data["routes"]) == 2
    assert data["warnings"] == ["Only 2 distinct route(s) exist between these places."]


@responses.activate
def test_heatmap_has_a_risk_per_hour_for_every_point(client):
    mock_providers([osrm_route(0, 2.0)], wind_for_lon=lambda lon: 50.0)
    res = client.post(
        "/api/heatmap",
        {
            "points": [[-104.9, 39.7], [-104.5, 40.0]],
            "departure": DEPART.isoformat(),
            "weight_lb": 35_000,
        },
        format="json",
    )
    assert res.status_code == 200
    data = res.json()
    assert data["hours"] == 49
    assert all(p["risk"] == [4] * 49 for p in data["points"])


@pytest.mark.parametrize(
    ("override", "field"),
    [
        ({"weight_lb": 0}, "weight_lb"),
        ({"interval_mi": 30}, "interval_mi"),
        ({"departure": (DEPART - timedelta(days=1)).isoformat()}, "departure"),
        ({"departure": (DEPART + timedelta(days=9)).isoformat()}, "departure"),
        ({"destination": ORIGIN}, "non_field_errors"),
    ],
)
def test_rejects_invalid_requests(client, override, field):
    res = plan(client, **override)
    assert res.status_code == 400
    assert field in res.json()


@responses.activate
def test_provider_outage_is_a_readable_503(client):
    responses.add(responses.GET, re.compile(r"https://router\.project-osrm\.org/.*"), status=502)
    res = plan(client)
    assert res.status_code == 503
    assert "OSRM" in res.json()["detail"]


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}

"""Geoapify provider: truck class by weight, response parsing, provider order."""

import json
from datetime import UTC, datetime, timedelta

import pytest
import responses
from django.core.cache import cache
from rest_framework.test import APIClient
from test_api import weather_callback

from planner.core.geo import destination
from planner.services import geocoding, routing
from planner.services.routing import GeoapifyRouting, geoapify_mode

KG_PER_LB = 0.45359237


@pytest.fixture(autouse=True)
def _geoapify(settings):
    settings.HERE_API_KEY = ""
    settings.GEOAPIFY_API_KEY = "test-key"
    settings.ALLOWED_HOSTS = ["testserver"]
    cache.clear()


@pytest.mark.parametrize(
    ("tonnes", "mode"),
    [
        (3.5, "light_truck"),
        (3.51, "medium_truck"),
        (7.5, "medium_truck"),
        (7.51, "truck"),
        (22.0, "truck"),
        (22.01, "heavy_truck"),
        (36.3, "heavy_truck"),  # US 80,000 lb gross limit
    ],
)
def test_truck_class_follows_gross_weight(tonnes, mode):
    assert geoapify_mode(tonnes * 1000 / KG_PER_LB) == mode


def test_parse_joins_legs_and_spreads_step_times():
    # Two legs sharing their joining point; leg one has two steps.
    leg1 = [[-105.0, 40.0], [-104.9, 40.0], [-104.7, 40.0]]
    leg2 = [[-104.7, 40.0], [-104.6, 40.0]]
    feature = {
        "geometry": {"type": "MultiLineString", "coordinates": [leg1, leg2]},
        "properties": {
            "distance": 30_000,
            "time": 1000,
            "legs": [
                {
                    "time": 400,
                    "steps": [
                        {"from_index": 0, "to_index": 1, "time": 100},
                        {"from_index": 1, "to_index": 2, "time": 300},
                    ],
                },
                {"time": 600, "steps": [{"from_index": 0, "to_index": 1, "time": 600}]},
            ],
        },
    }
    route = GeoapifyRouting._parse(feature)
    assert route.coords[0] == (40.0, -105.0)
    assert len(route.coords) == 4  # the shared point is kept once
    assert route.segment_seconds == pytest.approx([100, 300, 600])
    assert route.duration_s == 1000


def test_provider_order(settings):
    assert isinstance(routing.get_provider(), GeoapifyRouting)
    settings.HERE_API_KEY = "here-key"
    assert isinstance(routing.get_provider(), routing.HereRouting)
    settings.HERE_API_KEY = settings.GEOAPIFY_API_KEY = ""
    assert isinstance(routing.get_provider(), routing.OsrmRouting)


@responses.activate
def test_geocoding_uses_geoapify_labels():
    responses.add(
        responses.GET,
        "https://api.geoapify.com/v1/geocode/autocomplete",
        json={
            "results": [
                {"formatted": "Dallas, TX, United States of America", "lat": 32.78, "lon": -96.8}
            ]
        },
    )
    assert geocoding.search("dallas") == [
        {"label": "Dallas, TX, United States of America", "lat": 32.78, "lon": -96.8}
    ]
    assert "apiKey=test-key" in responses.calls[0].request.url


def _feature(bearing: float, hours: float) -> dict:
    pts = [(39.74, -104.99)]
    for _ in range(100):
        pts.append(destination(pts[-1], bearing, 1.0))
    return {
        "geometry": {"coordinates": [[[lon, lat] for lat, lon in pts]]},
        "properties": {
            "distance": 160_934,
            "time": hours * 3600,
            "legs": [
                {
                    "time": hours * 3600,
                    "steps": [{"from_index": 0, "to_index": 100, "time": hours * 3600}],
                }
            ],
        },
    }


@responses.activate
def test_plan_with_geoapify_forces_three_routes_and_sends_truck_mode():
    # One route per request: the direct one heads north, each via-point one
    # leaves on its own bearing so the planner keeps it as a distinct option.
    bearings = iter([0, 60, -60, 120, -120])

    def route_cb(request):
        return 200, {}, json.dumps({"features": [_feature(next(bearings), 2.0)]})

    responses.add_callback(responses.GET, "https://api.geoapify.com/v1/routing", callback=route_cb)
    responses.add_callback(
        responses.GET,
        "https://api.open-meteo.com/v1/forecast",
        callback=weather_callback(lambda lon: 5.0),
    )
    depart = (datetime.now(UTC) + timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
    res = APIClient().post(
        "/api/plan",
        {
            "origin": {"label": "Denver", "lat": 39.74, "lon": -104.99},
            "destination": {"label": "Cheyenne", "lat": 41.14, "lon": -104.82},
            "departure": depart.isoformat(),
            "weight_lb": 40_000,
            "interval_mi": 25,
        },
        format="json",
    )
    assert res.status_code == 200, res.json()
    data = res.json()
    assert data["provider"] == "Geoapify"
    assert len(data["routes"]) == 3
    first = responses.calls[0].request.url
    assert "mode=truck" in first and "apiKey=test-key" in first

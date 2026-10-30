"""Golden cases for every edge of the brief's risk table and load rules."""

import pytest

from planner.core.risk import RAIN_IN_HR, SNOW_IN_HR, WIND_MPH, Risk, Weather, assess, wind_risk

L, M, H, S, NT = Risk.LOW, Risk.MODERATE, Risk.HIGH, Risk.SEVERE, Risk.NO_TRAVEL


@pytest.mark.parametrize(
    ("mph", "expected"),
    [
        (0, L),
        (24.9, L),
        (25, M),
        (34.9, M),
        (35, H),
        (44.9, H),
        (45, S),
        (54.9, S),
        (55, NT),
        (80, NT),  # "≥55 mph": 55 itself is No Travel
    ],
)
def test_wind_bands(mph, expected):
    assert WIND_MPH.classify(mph) == expected


@pytest.mark.parametrize(
    ("in_hr", "expected"),
    [
        (0, L),
        (0.099, L),
        (0.10, M),
        (0.249, M),
        (0.25, H),
        (0.499, H),  # 0.25 is in both columns; the higher band owns its edge
        (0.50, S),
        (1.00, S),  # ">1.00": exactly 1.00 is still Severe
        (1.001, NT),
    ],
)
def test_rain_bands(in_hr, expected):
    assert RAIN_IN_HR.classify(in_hr) == expected


@pytest.mark.parametrize(
    ("in_hr", "expected"),
    [
        (0, L),
        (0.49, L),
        (0.5, M),
        (0.99, M),
        (1.0, H),
        (1.99, H),
        (2.0, S),
        (3.0, S),  # ">3.0": exactly 3.0 is still Severe
        (3.01, NT),
    ],
)
def test_snow_bands(in_hr, expected):
    assert SNOW_IN_HR.classify(in_hr) == expected


@pytest.mark.parametrize(
    ("mph", "lb", "expected"),
    [
        # ≥55 mph → No Travel for any load
        (55, 0, NT),
        (55, 1_000, NT),
        # 45–54 mph + >30,000 lb → No Travel
        (45, 30_000, S),
        (45, 30_001, NT),
        (54.9, 45_000, NT),
        # 35–44 mph + >40,000 lb → Severe
        (35, 40_000, H),
        (35, 40_001, S),
        (44.9, 80_000, S),
        # Load rules never touch winds below 35 mph
        (34.9, 80_000, M),
    ],
)
def test_load_rules(mph, lb, expected):
    assert wind_risk(mph, lb)[0] == expected


def test_overall_is_worst_condition():
    weather = Weather(wind_mph=10, rain_in_hr=0.3, snow_in_hr=2.5)
    result = assess(weather, weight_lb=20_000)
    assert result.level == S
    assert result.reasons == ["Snow 2.50 in/hr"]


def test_load_rule_reason_is_reported():
    result = assess(Weather(wind_mph=47, rain_in_hr=0, snow_in_hr=0), weight_lb=35_000)
    assert result.level == NT
    assert "35,000 lb" in result.reasons[0]


def test_calm_weather_has_no_reasons():
    assert assess(Weather(5, 0, 0), 80_000).reasons == []

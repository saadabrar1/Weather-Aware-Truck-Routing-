"""Weather risk classification, exactly as the assessment's risk and load rules.

The brief's table shares its edges between columns (rain 0.25 sits in both
Moderate and High), so every band here is half-open: a value equal to a band's
lower edge belongs to that band. The only exception is the No Travel column
for rain and snow, written as ">1.00" and ">3.0", so a value equal to that edge
stays Severe. Wind No Travel is written "≥55", so 55 itself is No Travel.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import IntEnum


class Risk(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def label(self) -> str:
        return self.name.replace("_", " ").title()


@dataclass(frozen=True)
class Thresholds:
    moderate: float
    high: float
    severe: float
    no_travel: float
    no_travel_inclusive: bool

    def classify(self, value: float) -> Risk:
        if value > self.no_travel or (self.no_travel_inclusive and value == self.no_travel):
            return Risk.NO_TRAVEL
        if value >= self.severe:
            return Risk.SEVERE
        if value >= self.high:
            return Risk.HIGH
        if value >= self.moderate:
            return Risk.MODERATE
        return Risk.LOW


WIND_MPH = Thresholds(25, 35, 45, 55, no_travel_inclusive=True)
RAIN_IN_HR = Thresholds(0.10, 0.25, 0.50, 1.00, no_travel_inclusive=False)
SNOW_IN_HR = Thresholds(0.5, 1.0, 2.0, 3.0, no_travel_inclusive=False)

# Load rules, keyed by the wind band they apply to: (weight above, result).
# ≥55 mph is already No Travel for any load through WIND_MPH.
NO_TRAVEL_LOAD_LB = 30_000  # 45–54 mph
SEVERE_LOAD_LB = 40_000  # 35–44 mph


@dataclass(frozen=True)
class Weather:
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float


@dataclass(frozen=True)
class Assessment:
    level: Risk
    reasons: list[str] = field(default_factory=list)


def wind_risk(wind_mph: float, weight_lb: float) -> tuple[Risk, str | None]:
    """Wind band after the load rules. Returns the band and, if a load rule fired, why."""
    band = WIND_MPH.classify(wind_mph)
    loaded = f"Wind {wind_mph:.0f} mph with a {weight_lb:,.0f} lb load"
    if band == Risk.SEVERE and weight_lb > NO_TRAVEL_LOAD_LB:
        return Risk.NO_TRAVEL, f"{loaded} (over {NO_TRAVEL_LOAD_LB:,} lb)"
    if band == Risk.HIGH and weight_lb > SEVERE_LOAD_LB:
        return Risk.SEVERE, f"{loaded} (over {SEVERE_LOAD_LB:,} lb)"
    return band, None


def assess(weather: Weather, weight_lb: float) -> Assessment:
    """Overall risk is the worst of wind (after load rules), rain and snow."""
    wind, load_reason = wind_risk(weather.wind_mph, weight_lb)
    parts = {
        "wind": (wind, f"Wind {weather.wind_mph:.0f} mph"),
        "rain": (RAIN_IN_HR.classify(weather.rain_in_hr), f"Rain {weather.rain_in_hr:.2f} in/hr"),
        "snow": (SNOW_IN_HR.classify(weather.snow_in_hr), f"Snow {weather.snow_in_hr:.2f} in/hr"),
    }
    level = max(risk for risk, _ in parts.values())
    reasons: list[str] = []
    if level > Risk.LOW:
        for name, (risk, text) in parts.items():
            if risk == level:
                reasons.append(load_reason if name == "wind" and load_reason else text)
    return Assessment(level=level, reasons=reasons)

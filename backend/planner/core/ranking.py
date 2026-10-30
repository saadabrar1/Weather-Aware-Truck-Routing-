"""Pick the recommended route using the brief's order of preference:

1. fewest Severe miles, 2. fewest High miles, 3. lowest average risk,
4. shortest travel time.

No Travel miles are compared before all four. The brief lists No Travel as a
risk level but leaves it out of the ranking; a route that crosses No Travel
weather must never beat one that is only Severe, so it goes first.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from .risk import Risk
from .sampling import Checkpoint

# Miles are rounded before comparing so float noise from the sampling step
# can't decide a tie that the weather didn't.
_MILE_PRECISION = 1


@dataclass(frozen=True)
class RouteRisk:
    route_id: str
    distance_mi: float
    duration_s: float
    miles_by_level: dict[Risk, float]
    avg_risk: float

    def sort_key(self) -> tuple[float, float, float, float, float]:
        m = {k: round(v, _MILE_PRECISION) for k, v in self.miles_by_level.items()}
        return (
            m[Risk.NO_TRAVEL],
            m[Risk.SEVERE],
            m[Risk.HIGH],
            round(self.avg_risk, 3),
            self.duration_s,
        )


def summarize(
    route_id: str,
    distance_mi: float,
    duration_s: float,
    checkpoints: Iterable[Checkpoint],
    levels: Iterable[Risk],
) -> RouteRisk:
    miles = {level: 0.0 for level in Risk}
    weighted = 0.0
    counted = 0.0
    for cp, level in zip(checkpoints, levels, strict=True):
        miles[level] += cp.span_mi
        weighted += int(level) * cp.span_mi
        counted += cp.span_mi
    return RouteRisk(
        route_id=route_id,
        distance_mi=distance_mi,
        duration_s=duration_s,
        miles_by_level=miles,
        avg_risk=weighted / counted if counted else 0.0,
    )


def rank(routes: list[RouteRisk]) -> list[RouteRisk]:
    """Best first. Python's sort is stable, so full ties keep the provider's order."""
    return sorted(routes, key=RouteRisk.sort_key)


_CRITERIA = ("No Travel miles", "Severe miles", "High miles", "average risk", "travel time")


def explain(ranked: list[RouteRisk]) -> str:
    """Which rule put the recommended route ahead of the runner-up."""
    if len(ranked) < 2:
        return "Only route available."
    best, runner_up = ranked[0].sort_key(), ranked[1].sort_key()
    for i, name in enumerate(_CRITERIA):
        if best[i] < runner_up[i]:
            if i == 4:
                minutes = round((runner_up[i] - best[i]) / 60)
                return f"Same weather risk as the next route, and {minutes} min faster."
            if i == 3:
                # Ranking compares three decimals; show as many as it takes
                # for the two numbers to differ, or "0.15 vs 0.15" reads as a tie.
                digits = 2 if f"{best[i]:.2f}" != f"{runner_up[i]:.2f}" else 3
                return (
                    f"Lower average risk than the next route "
                    f"({best[i]:.{digits}f} vs {runner_up[i]:.{digits}f})."
                )
            return f"Fewer {name} than the next route ({best[i]:g} vs {runner_up[i]:g})."
    return "Ties with the next route on every rule."

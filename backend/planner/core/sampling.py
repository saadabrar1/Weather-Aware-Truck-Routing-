"""Place weather checkpoints along a route and work out when the truck reaches each one."""

from __future__ import annotations

import bisect
from dataclasses import dataclass
from datetime import datetime, timedelta

from .geo import LatLon, cumulative_miles, lerp

ALLOWED_INTERVALS_MI = (10, 25, 50)


@dataclass(frozen=True)
class Checkpoint:
    mile: float
    lat: float
    lon: float
    eta: datetime
    # Miles of road this checkpoint's weather stands for (see `represented_miles`).
    span_mi: float


def sample_checkpoints(
    coords: list[LatLon],
    segment_seconds: list[float],
    departure: datetime,
    interval_mi: float,
) -> list[Checkpoint]:
    """One checkpoint at the origin, one every `interval_mi`, and one at the destination.

    ETAs come from the routing engine's own per-segment travel times, so a slow
    city stretch takes longer to cross than an interstate one of the same length.
    """
    if len(coords) < 2 or len(segment_seconds) != len(coords) - 1:
        raise ValueError("need at least two coordinates and one duration per segment")
    if interval_mi <= 0:
        raise ValueError("interval must be positive")

    miles = cumulative_miles(coords)
    seconds = [0.0]
    for s in segment_seconds:
        seconds.append(seconds[-1] + max(s, 0.0))
    total = miles[-1]

    targets = [i * interval_mi for i in range(int(total // interval_mi) + 1)]
    # Skip a final sample that would sit almost on top of the destination.
    if total - targets[-1] < 0.5 and len(targets) > 1:
        targets.pop()
    targets.append(total)

    points = [locate(m, coords, miles, seconds) for m in targets]
    spans = represented_miles(targets)
    return [
        Checkpoint(
            mile=round(m, 2),
            lat=lat,
            lon=lon,
            eta=departure + timedelta(seconds=secs),
            span_mi=span,
        )
        for m, (lat, lon, secs), span in zip(targets, points, spans, strict=True)
    ]


def represented_miles(marks: list[float]) -> list[float]:
    """Each checkpoint stands for the road halfway back to the previous one and
    halfway on to the next, so every mile of the route is counted exactly once."""
    if len(marks) == 1:
        return [0.0]
    out = []
    for i, m in enumerate(marks):
        start = marks[0] if i == 0 else (marks[i - 1] + m) / 2
        end = marks[-1] if i == len(marks) - 1 else (m + marks[i + 1]) / 2
        out.append(end - start)
    return out


def locate(
    target_mi: float, coords: list[LatLon], miles: list[float], seconds: list[float]
) -> tuple[float, float, float]:
    i = bisect.bisect_right(miles, target_mi) - 1
    i = min(max(i, 0), len(coords) - 2)
    seg_len = miles[i + 1] - miles[i]
    t = 0.0 if seg_len == 0 else min(max((target_mi - miles[i]) / seg_len, 0.0), 1.0)
    lat, lon = lerp(coords[i], coords[i + 1], t)
    return lat, lon, seconds[i] + (seconds[i + 1] - seconds[i]) * t

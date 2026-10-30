from datetime import UTC, datetime, timedelta

import pytest

from planner.core.geo import cumulative_miles, destination
from planner.core.sampling import represented_miles, sample_checkpoints

DEPART = datetime(2026, 11, 2, 8, 0, tzinfo=UTC)


def straight_route(total_mi: float, step_mi: float = 1.0):
    """A due-east route with a vertex every `step_mi`."""
    coords = [(40.0, -105.0)]
    while cumulative_miles(coords)[-1] < total_mi - 1e-9:
        remaining = total_mi - cumulative_miles(coords)[-1]
        coords.append(destination(coords[-1], 90, min(step_mi, remaining)))
    return coords


@pytest.mark.parametrize(("interval", "expected"), [(10, 11), (25, 5), (50, 3)])
def test_checkpoint_count_includes_origin_and_destination(interval, expected):
    coords = straight_route(100)
    cps = sample_checkpoints(coords, [60.0] * (len(coords) - 1), DEPART, interval)
    assert len(cps) == expected
    assert cps[0].mile == 0
    assert cps[-1].mile == pytest.approx(100, abs=0.05)


def test_checkpoints_are_spaced_by_interval():
    coords = straight_route(120)
    cps = sample_checkpoints(coords, [60.0] * (len(coords) - 1), DEPART, 25)
    assert [round(c.mile) for c in cps] == [0, 25, 50, 75, 100, 120]


def test_eta_follows_segment_durations_not_distance():
    # First 50 miles crawl at 25 mph (2 h); last 50 run at 50 mph (1 h).
    coords = straight_route(100, step_mi=50)
    cps = sample_checkpoints(coords, [7200.0, 3600.0], DEPART, 50)
    assert [c.eta - DEPART for c in cps] == [
        timedelta(0),
        timedelta(hours=2),
        timedelta(hours=3),
    ]


def test_eta_interpolates_inside_a_segment():
    coords = straight_route(100, step_mi=100)
    cps = sample_checkpoints(coords, [7200.0], DEPART, 25)
    assert cps[1].eta - DEPART == pytest.approx(timedelta(minutes=30), abs=timedelta(seconds=5))


def test_sample_almost_on_destination_is_merged():
    coords = straight_route(50.3)
    cps = sample_checkpoints(coords, [60.0] * (len(coords) - 1), DEPART, 25)
    assert [round(c.mile, 1) for c in cps] == [0, 25, 50.3]


def test_represented_miles_cover_route_exactly_once():
    marks = [0, 25, 50, 75, 90]
    spans = represented_miles(marks)
    assert spans == [12.5, 25, 25, 20, 7.5]
    assert sum(spans) == 90


def test_rejects_mismatched_durations():
    with pytest.raises(ValueError):
        sample_checkpoints([(0, 0), (0, 1)], [], DEPART, 10)

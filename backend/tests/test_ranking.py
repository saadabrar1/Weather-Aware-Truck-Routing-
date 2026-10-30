"""One test per ranking rule: the routes differ only on the rule under test,
plus a test that each rule outranks the ones after it."""

from planner.core.ranking import RouteRisk, explain, rank
from planner.core.risk import Risk


def route(rid, *, no_travel=0, severe=0, high=0, avg=0.5, hours=5.0):
    miles = {level: 0.0 for level in Risk}
    miles.update({Risk.NO_TRAVEL: no_travel, Risk.SEVERE: severe, Risk.HIGH: high})
    return RouteRisk(rid, 300, hours * 3600, miles, avg)


def best(*routes):
    return rank(list(routes))[0].route_id


def test_fewest_severe_miles_first():
    assert best(route("a", severe=40), route("b", severe=10)) == "b"


def test_fewest_high_miles_second():
    assert best(route("a", high=40), route("b", high=10)) == "b"


def test_lowest_average_risk_third():
    assert best(route("a", avg=1.2), route("b", avg=0.8)) == "b"


def test_shortest_time_last():
    assert best(route("a", hours=6), route("b", hours=5)) == "b"


def test_severe_outranks_high_avg_and_time():
    safer = route("safer", severe=0, high=200, avg=2.0, hours=9)
    faster = route("faster", severe=5, high=0, avg=0.1, hours=4)
    assert best(faster, safer) == "safer"


def test_high_outranks_avg_and_time():
    assert best(route("a", high=30, avg=0.1, hours=3), route("b", high=10, avg=2, hours=8)) == "b"


def test_average_outranks_time():
    assert best(route("a", avg=1.0, hours=3), route("b", avg=0.5, hours=8)) == "b"


def test_no_travel_ranks_below_any_severe():
    assert best(route("a", no_travel=1), route("b", severe=300)) == "b"


def test_float_noise_does_not_decide():
    assert best(route("a", severe=10.00001, hours=4), route("b", severe=10.0, hours=5)) == "a"


def test_explain_names_deciding_rule():
    ranked = rank([route("a", severe=40), route("b", severe=10)])
    assert explain(ranked) == "Fewer Severe miles than the next route (10 vs 40)."


def test_explain_time_tiebreak():
    ranked = rank([route("a", hours=6), route("b", hours=5)])
    assert explain(ranked) == "Same weather risk as the next route, and 60 min faster."


def test_explain_average_never_reads_as_a_tie():
    ranked = rank([route("a", avg=0.154), route("b", avg=0.152)])
    assert explain(ranked) == "Lower average risk than the next route (0.152 vs 0.154)."

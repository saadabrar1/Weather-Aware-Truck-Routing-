from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from planner.core.geo import haversine_mi
from planner.core.sampling import ALLOWED_INTERVALS_MI

# Forecasts lose their value after about a week, and the 48-hour heatmap
# window has to fit inside the provider's 16-day horizon either way.
MAX_DAYS_AHEAD = 7
# US gross weight limit is 80,000 lb; permitted oversize loads go well beyond.
MAX_WEIGHT_LB = 200_000


class PlaceSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=300)
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)


def validate_departure(value):
    now = timezone.now()
    if value < now - timedelta(hours=1):
        raise serializers.ValidationError("Departure can't be in the past.")
    if value > now + timedelta(days=MAX_DAYS_AHEAD):
        raise serializers.ValidationError(
            f"Departure must be within the next {MAX_DAYS_AHEAD} days of forecast."
        )
    return value


class PlanRequestSerializer(serializers.Serializer):
    origin = PlaceSerializer()
    destination = PlaceSerializer()
    departure = serializers.DateTimeField(validators=[validate_departure])
    weight_lb = serializers.FloatField(min_value=1, max_value=MAX_WEIGHT_LB)
    interval_mi = serializers.ChoiceField(choices=ALLOWED_INTERVALS_MI, default=25)

    def validate(self, attrs):
        o, d = attrs["origin"], attrs["destination"]
        if haversine_mi((o["lat"], o["lon"]), (d["lat"], d["lon"])) < 1:
            raise serializers.ValidationError("Origin and destination are the same place.")
        return attrs


class HeatmapRequestSerializer(serializers.Serializer):
    points = serializers.ListField(
        child=serializers.ListField(child=serializers.FloatField(), min_length=2, max_length=2),
        min_length=1,
        max_length=600,
    )
    departure = serializers.DateTimeField(validators=[validate_departure])
    weight_lb = serializers.FloatField(min_value=1, max_value=MAX_WEIGHT_LB)

from django.conf import settings
from django.http import FileResponse, Http404
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView, exception_handler

from planner import planning
from planner.serializers import HeatmapRequestSerializer, PlanRequestSerializer
from planner.services import geocoding
from planner.services.http import UpstreamError


class UpstreamUnavailable(APIException):
    status_code = 503
    default_code = "upstream_unavailable"


def api_exception_handler(exc, context):
    # Provider outages surface as a readable 503 instead of a 500 page.
    if isinstance(exc, UpstreamError):
        exc = UpstreamUnavailable(str(exc))
    return exception_handler(exc, context)


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class GeocodeView(APIView):
    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response([])
        if len(query) > 200:
            raise ValidationError({"q": "Search text is too long."})
        return Response(geocoding.search(query))


class PlanView(APIView):
    def post(self, request):
        s = PlanRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        return Response(
            planning.plan_trip(
                origin=(d["origin"]["lat"], d["origin"]["lon"]),
                dest=(d["destination"]["lat"], d["destination"]["lon"]),
                departure=d["departure"],
                weight_lb=d["weight_lb"],
                interval_mi=d["interval_mi"],
            )
        )


class HeatmapView(APIView):
    def post(self, request):
        s = HeatmapRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        points = [(lat, lon) for lon, lat in d["points"]]
        return Response(planning.corridor_forecast(points, d["departure"], d["weight_lb"]))


def spa_index(request, path=""):
    """Client-side routes (/app, ...) all load the React build's index.html."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        raise Http404("Frontend build not found. Run `npm run build` in frontend/.")
    return FileResponse(index.open("rb"), content_type="text/html")

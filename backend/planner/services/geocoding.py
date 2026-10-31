"""Place search for the origin/destination inputs."""

from __future__ import annotations

from dataclasses import asdict, dataclass

from django.conf import settings
from django.core.cache import cache

from .http import get_json

LIMIT = 5


@dataclass(frozen=True)
class Place:
    label: str
    lat: float
    lon: float


def _provider():
    if settings.HERE_API_KEY:
        return "here", _here
    if settings.GEOAPIFY_API_KEY:
        return "geoapify", _geoapify
    return "photon", _photon


def search(query: str) -> list[dict]:
    name, lookup = _provider()
    key = f"geo:{name}:{query.lower()}"
    hit = cache.get(key)
    if hit is not None:
        return hit
    places = lookup(query)
    # A city often matches several map objects (boundary, centre node, ...) with
    # the same name; one suggestion per label is enough.
    unique = {p.label: p for p in reversed(places)}
    result = [asdict(unique[label]) for label in dict.fromkeys(p.label for p in places)]
    cache.set(key, result, 24 * 3600)
    return result


def _here(query: str) -> list[Place]:
    data = get_json(
        "https://geocode.search.hereapi.com/v1/geocode",
        {"q": query, "limit": LIMIT, "apiKey": settings.HERE_API_KEY},
        provider="HERE geocoding",
    )
    return [
        Place(item["title"], item["position"]["lat"], item["position"]["lng"])
        for item in data.get("items", [])
    ]


def _geoapify(query: str) -> list[Place]:
    data = get_json(
        "https://api.geoapify.com/v1/geocode/autocomplete",
        {
            "text": query,
            "limit": LIMIT,
            "format": "json",
            "lang": "en",
            "apiKey": settings.GEOAPIFY_API_KEY,
        },
        provider="Geoapify geocoding",
    )
    return [Place(r["formatted"], r["lat"], r["lon"]) for r in data.get("results", [])]


def _photon(query: str) -> list[Place]:
    data = get_json(
        f"{settings.PHOTON_URL}/api/",
        {"q": query, "limit": LIMIT, "lang": "en"},
        provider="Photon geocoding",
    )
    places = []
    for f in data.get("features", []):
        p = f["properties"]
        parts = [p.get("name"), p.get("city"), p.get("state"), p.get("country")]
        label = ", ".join(dict.fromkeys(x for x in parts if x))
        lon, lat = f["geometry"]["coordinates"]
        places.append(Place(label, lat, lon))
    return places

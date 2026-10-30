"""Shared HTTP session for upstream APIs: timeouts, a few retries, one error type."""

from __future__ import annotations

import logging

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

log = logging.getLogger(__name__)


class UpstreamError(Exception):
    """A routing, geocoding or weather provider failed or returned nothing usable."""


def _session() -> requests.Session:
    s = requests.Session()
    # Retry brief server hiccups only. A 429 is not retried: Open-Meteo answers
    # it with Retry-After: 60, and waiting a minute inside a request is worse
    # than a clear "try again" message.
    retry = Retry(
        total=2,
        backoff_factor=0.5,
        status_forcelist=(500, 502, 503, 504),
        allowed_methods=("GET",),
        respect_retry_after_header=False,
    )
    s.mount("https://", HTTPAdapter(max_retries=retry, pool_maxsize=16))
    s.headers["User-Agent"] = "weather-aware-truck-routing/1.0"
    return s


_SESSION = _session()
# For optional calls (extra route alternatives): one short try, no retries.
_QUICK_SESSION = requests.Session()
_QUICK_SESSION.headers.update(_SESSION.headers)
QUICK_TIMEOUT_S = 6


def get_json(url: str, params: dict | None = None, *, provider: str, quick: bool = False):
    session, timeout = (
        (_QUICK_SESSION, QUICK_TIMEOUT_S) if quick else (_SESSION, settings.UPSTREAM_TIMEOUT_S)
    )
    try:
        resp = session.get(url, params=params, timeout=timeout)
    except requests.RequestException as exc:
        log.warning("%s request failed: %s", provider, exc)
        raise UpstreamError(f"{provider} is unreachable right now. Please try again.") from exc
    if resp.status_code == 429:
        log.warning("%s rate limit hit", provider)
        raise UpstreamError(f"{provider} is busy (rate limit). Please try again in a minute.")
    if resp.status_code >= 400:
        log.warning("%s returned %s: %s", provider, resp.status_code, resp.text[:300])
        raise UpstreamError(f"{provider} returned an error ({resp.status_code}).")
    return resp.json()

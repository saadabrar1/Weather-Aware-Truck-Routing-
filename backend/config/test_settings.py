"""Settings for the test suite: debug defaults so no secret key is needed."""

import os

os.environ.setdefault("DJANGO_DEBUG", "true")

from .settings import *  # noqa: E402,F403

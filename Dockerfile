# syntax=docker/dockerfile:1

# --- Stage 1: build the React app -------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Django API that also serves the built app ---------------------
FROM python:3.12-slim AS app

# Links the published image to this repository on GitHub Container Registry.
LABEL org.opencontainers.image.source="https://github.com/saadabrar1/Weather-Aware-Truck-Routing-"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FRONTEND_DIST=/app/frontend_dist \
    PORT=8000

WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/ ./
COPY --from=frontend /frontend/dist /app/frontend_dist

RUN useradd --create-home --uid 10001 app
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ[\"PORT\"]}/api/health', timeout=4)"

# Requests wait on routing and forecast APIs, so threads (not more processes)
# carry the concurrency. The port comes from $PORT (8000 by default).
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --worker-class gthread --workers 2 --threads 8 --timeout 120 --access-logfile -"]

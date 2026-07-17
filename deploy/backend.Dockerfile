FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    SMART_SPATIAL_RUNTIME_DIR=/app/var \
    GEOCHAT_PLUGIN_CONFIG_DIR=/app/config/plugins

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       curl \
       gdal-bin \
       libgdal-dev \
       libgeos-dev \
       libproj-dev \
       proj-bin \
    && rm -rf /var/lib/apt/lists/*

COPY backend/ /app/

RUN python -m pip install --upgrade pip \
    && python -m pip install ".[geo]"

RUN mkdir -p \
    /app/var/outputs \
    /app/var/uploads \
    /app/var/projects \
    /app/var/reports \
    /app/var/cache

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/v1/health || exit 1

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]

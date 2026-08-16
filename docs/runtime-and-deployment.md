# Runtime and deployment

## Confirmed configuration

The backend requires Python >=3.11 (`backend/pyproject.toml`) and Docker installs `.[geo]`, including geopandas/rasterio. It also installs GDAL/GEOS/PROJ (`deploy/backend.Dockerfile:10-18`). The production image does **not** install the `pdf` extra, although PDF code imports optional WeasyPrint. `docker-compose.yaml` mounts one named volume at `/app/var`; backend defaults `SMART_SPATIAL_RUNTIME_DIR=/app/var` and plugin YAML at `/app/config/plugins`.

LLM environment names are inconsistent: `.env.example` supplies `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `LLM_*_MODEL`, but QuerySpec's client also reads `LLM_BASE_URL` and defaults to AvalAI (`llm_spec_generator.py:61-72`). Intent planning requires a configured base URL (`llm_intent_planner.py:99-114`).

## Runtime paths

`RuntimePaths.from_env` is used from `service.py:427`. The Dockerfile creates `var/outputs`, `uploads`, `projects`, `reports`, and `cache`; projects/uploads/outputs are local JSON/file stores, not a database/object store.

## Risks

- Compose has no external port mapping; nginx can proxy within the network but host access in README is not configured.
- There is no authentication, authorization, tenant isolation, rate limiting, database migration, backup, retention, observability stack, or worker queue evidenced by repository configuration.
- Plugin configuration/state may be persisted in a location different from copied source config (`service.py:449-453` resolves it under runtime root), requiring runtime inspection to confirm enabled state.

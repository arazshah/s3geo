# Phase 2 baseline environment

## Scope and method

This is a reproducible, read-only runtime baseline taken on 2026-08-16. No production source, dependency manifest, lockfile, or container configuration was changed. A local `backend/.venv` and `/tmp/s3geo-phase2-runtime` were created as disposable test state.

## Observed host/toolchain

| Item | Observed value | Evidence |
| --- | --- | --- |
| OS/runtime | Linux; Python 3.12.3 | `python3 --version` |
| Node/npm | Node 24.11.1; npm 11.6.2 | `node --version`, `npm --version` |
| Container engine | Docker 29.1.3; legacy Compose 1.29.2 | `docker --version`, `docker-compose --version` |
| Backend requirement | Python `>=3.11`; image uses Python 3.12 slim | [backend/pyproject.toml](/home/araz/Projects/Career/s3geo/backend/pyproject.toml), [backend/Dockerfile](/home/araz/Projects/Career/s3geo/backend/Dockerfile) |
| Frontend requirement | no `engines` constraint; image uses Node 22 Alpine | [frontend/package.json](/home/araz/Projects/Career/s3geo/frontend/package.json), [frontend/Dockerfile](/home/araz/Projects/Career/s3geo/frontend/Dockerfile) |

## Repository state

`git status --short` showed only the documentation directory as untracked at baseline start. This phase added baseline documentation only. There was no repository `AGENTS.md` at the root.

## Local runtime configuration used

The API was started from `backend/` with:

```bash
SMART_SPATIAL_RUNTIME_DIR=/tmp/s3geo-phase2-runtime \
GEOCHAT_PLUGIN_CONFIG_DIR=/home/araz/Projects/Career/s3geo/backend/config/plugins \
LLM_PLANNING_ENABLED=false QUERY_SPEC_PLANNING_ENABLED=false \
.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8001
```

The two planning flags deliberately disable external/provider-dependent planning. Results from this server therefore demonstrate deterministic/direct and legacy-routing behavior, not the default provider-backed mode. The frontend was started at `http://127.0.0.1:5173` with `VITE_API_BASE_URL=http://127.0.0.1:8001`.

## Important environment limits

* The repository `.env` file was absent. `docker-compose config` therefore stopped before configuration expansion: `Couldn't find env file: .../.env`.
* Port 5173 is in the backend default CORS allow-list; 5174 is not. A frontend on 5174 loaded but the browser rejected the API response because the CORS response lacked `Access-Control-Allow-Origin`. See [backend/api/main.py](/home/araz/Projects/Career/s3geo/backend/api/main.py:48).
* `GET /api/v1/planner/intent` returned HTTP 400 with `OPENAI_BASE_URL or LLM_BASE_URL is not configured.` No real LLM provider, credentials, PostGIS instance, or production object store was supplied, so those integrations remain unverified.

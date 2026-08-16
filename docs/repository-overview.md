# Repository overview

## Confirmed structure

| Directory/file | Responsibility and evidence |
|---|---|
| `frontend/` | Active React 19/Vite/Leaflet SPA (`frontend/package.json`, `src/main.tsx`, `src/App.tsx`). |
| `frontend/smart-spatial-frontend/` | A second minimal Vite project; Docker does not build it. No evidence it is runtime-active. |
| `backend/api/` | FastAPI app, request models, and HTTP routes; `api/main.py:77-118`. |
| `backend/orchestrator/` | Active facade, stores, capability registry, routing, response/output assembly. |
| `backend/smart_spatial_system/application/services/` | Extracted application-service layer used by the facade, especially `query_execution_service.py`. |
| `backend/plugins/` | Capability-decorated geospatial, connector, reporting, and loader implementations. |
| `backend/geochat_sdk/`, `backend/geochat_kernel/` | Plugin/capability types, registries, and optional kernel execution infrastructure. |
| `backend/config/plugins/` | Per-plugin YAML configuration; loaded using `GEOCHAT_PLUGIN_CONFIG_DIR`. |
| `backend/tests/` | Broad unit/contract/integration-named pytest suite. Execution could not be verified locally. |
| `backend/audit/`, `*.bak`, `*.before_*`, `frontend/backups/` | Historical/debug artifacts, not imported by the Docker entrypoint as verified. |

## Entry points and start commands

`deploy/backend.Dockerfile:34` starts `uvicorn api.main:app --host 0.0.0.0 --port 8000`. `deploy/frontend.Dockerfile` runs `npm run build` in `frontend/` and nginx. For development, package scripts provide `npm run dev`; backend README directs `uvicorn api.main:app --host 127.0.0.1 --port 8000`.

## Inferred intent

The repository is attempting an MVP platform rather than one narrowly scoped GIS workflow: generic raster/vector operations, source connectors, project organization, ranking/reporting, LLM planning, feedback-driven router weights, and a specialized real-estate workflow coexist.

## Confirmed defects/weaknesses

- `docker-compose.yaml` has only `expose`, no `ports`; README advertises host `localhost:8080`/`8000` (`README.md`, Compose). Those URLs are not published by this Compose file.
- The second frontend, backup files, audit scripts/diffs, duplicate `geochat_kernel/runtime/router(s)` packages, and `*.before_*` source copies create substantial source-of-truth ambiguity.
- `backend/pyproject.toml` excludes `templates*` even though `plugins/pdf_renderer.py:39` loads `templates/reports`; Docker copies source intact, but a built distribution may omit templates.

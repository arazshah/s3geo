# S3Geo project context

S3Geo is a containerized MVP for natural-language geospatial analysis. Its active product is a React/Leaflet single-page workspace backed by FastAPI. Users can create file-backed projects, upload/register datasets, submit a natural-language query, inspect outputs, map layers, files, and request history.

The HTTP entry point is `backend/api/main.py:create_app`; deployment starts `uvicorn api.main:app`. The frontend entry point is `frontend/src/main.tsx`, with most UI state and request composition in `frontend/src/App.tsx`. Docker builds that frontend and proxies `/api/` to the backend via nginx.

`OrchestratorService` (`backend/orchestrator/service.py`) is the API facade. It builds a plugin capability registry, file stores, a query-execution service, and response/output helpers. Runtime data is local JSON/files under `SMART_SPATIAL_RUNTIME_DIR` (`uploads`, `projects`, `outputs`, `reports`). Request history is in-memory; projects and data files survive only through their individual JSON/file stores.

The normal `/api/v1/query` path validates a loose request envelope, resolves only `raster_ref`/`vector_ref` upload references, invokes optional LLM intent planning, then dispatches special real-estate/vector paths, QuerySpec LLM planning (default enabled by `.env.example`), or a deterministic keyword/weighted router. QuerySpec planning asks an OpenAI-compatible `/chat/completions` endpoint for JSON, normalizes/repairs it, validates it, and executes a DAG of registry capabilities. A separate legacy keyword pipeline remains reachable as fallback.

Key contracts are intentionally permissive and duplicated: frontend uses multiple request shapes and response normalizers; backend has unversioned and `/api/v1` routes plus multiple response aliases. The only explicit role precedence observed for nearest planning is direct resolved `inputs.source/target`, then context/metadata `input_roles`, then `role_bindings`, then `data_sources` roles; the UI separately guesses source/target from dataset-name keywords.

Known critical risks: overlapping architectural layers and dead-looking duplicate frontend; default-on LLM planning with broad exception conversion; extensive LLM plan mutation; in-memory request history breaks after restart; output persistence is non-transactional; unprofiled uploads; role binding is heuristic; frontend ignores several backend options; deployment exposes no host ports in Compose despite README URLs; tests cannot collect in the audited environment due missing dependencies.

Read these before changes: `docs/current-system-architecture.md`, `docs/request-lifecycle.md`, `docs/dataset-lifecycle.md`, `docs/llm-and-planning-pipeline.md`, and `docs/fragility-and-risk-register.md`.

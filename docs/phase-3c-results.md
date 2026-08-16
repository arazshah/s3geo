# Phase 3C results: Projects API to AI Query selector

## Root cause

The backend list contract was already valid: `GET /api/v1/projects` returns a plain list of records with `project_id` and `name`. The AI Query selector loaded it only once when `App` mounted. A project created later in the Projects workspace therefore never refreshed `availableProjects`, leaving the selector disabled with “No projects loaded.” The former frontend parser was also permissive and lived in `App` rather than the API boundary.

## Changes

- Added typed `ProjectListItem` parsing/deduplication in `frontend/src/lib/api.ts`.
- Refresh projects on entering AI Query; preserve only a still-valid explicit selection, clear a disappeared selection, and do not auto-select list order.
- Added explicit loading, empty, and error selector states in `TopQueryPanel`.
- Retained the public optional `project_id` query field; query router validates it through the existing project service and returns safe structured `input.project_not_found` errors.
- Added project-plus-`data_source_ids` vector-display coverage; it retains Phase 3B normalization and skips LLM planning.

## Verification

- `backend/.venv/bin/python -m pytest -q tests/test_api_vector_display_dataset_selection.py tests/test_api_projects.py tests/test_query_response_frontend_contract.py --tb=short`: **11 passed, 1 warning**, exit 0, 2.29s.
- `backend/.venv/bin/python -m pytest -q --tb=short`: **1,634 passed, 0 failed, 0 errors, 7 warnings**, exit 0, 63.55s.
- `frontend npm run build`: passed, exit 0.
- `frontend npm run lint`: **passed**, exit 0. The safe ESLint configuration correction ignores only the non-authoritative nested frontend and backup trees and explicitly selects the active TypeScript root. Follow-up localized source fixes resolved the 10 active-source rule errors and one warning without disabling rules.
- No frontend test script or usable frontend test framework exists in `frontend/package.json`.
- Isolated HTTP smoke validation used backend `127.0.0.1:8003`, Vite `127.0.0.1:5173`, and `SMART_SPATIAL_RUNTIME_DIR=/tmp/s3geo-phase3c-smoke`. Health, project list/create/list, frontend root, and CORS returned HTTP 200. A valid project plus explicit `inputs.vector_ref` returned `succeeded`, `FeatureCollection` GeoJSON, accepted project-context metadata, and explicit-reference precedence; a valid `data_source_ids` selection also succeeded deterministically. Unknown project and ambiguous dataset requests returned the documented structured 400 errors.
- Browser UI validation was not performed. The in-app browser rejected localhost navigation after an initial connection failure, so HTTP smoke evidence is not labelled as browser rendering evidence.

## Limitations

Projects remain local file-backed records; there is no authentication, durability guarantee beyond the runtime volume, or implied project-to-dataset ownership/scoping. The working global upload/vector flow remains project-optional. The non-blocking backend warnings are one FastAPI/Starlette TestClient deprecation warning and six Rasterio `src.is_tiled` pending deprecation warnings in `backend/plugins/local_raster_loader.py:220`.

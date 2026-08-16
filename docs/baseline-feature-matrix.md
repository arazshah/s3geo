# Phase 2 baseline feature matrix (with Phase 3B re-verification)

All runtime observations use the isolated server configuration documented in [baseline-environment.md](baseline-environment.md).

| Workflow | Evidence | Baseline outcome | Classification |
| --- | --- | --- | --- |
| API health and plugin inventory | `GET /api/v1/health`, `GET /api/v1/plugins` | HTTP 200; 34 enabled plugin modules listed | confirmed working |
| Vector upload | `POST /api/v1/uploads/vector` for both Austria sample GeoJSON files | 2 uploads accepted and persisted in temporary runtime storage | confirmed working |
| Upload discovery | `GET /api/v1/uploads` | 2 uploads listed | confirmed working |
| Direct vector display | `POST /api/v1/query` with `inputs.vector_ref` and `show vector features` | success: 3 features, GeoJSON and map layers returned | confirmed working, partial |
| Selected-upload vector display (Phase 3B) | Browser upload + one AI Query selection sent as `data_source_ids` | success; frontend renders 2 visible GeoJSON layers; deterministic request bypasses LLM intent planning | confirmed working, narrow vertical slice |
| Map-layer retrieval | `GET /api/v1/requests/{id}/map-layers` | 2 layers returned (`austria_candidate_areas`, `active_vector`) | confirmed working; duplicate semantic layer risk |
| Output file manifest after direct vector display | `GET /api/v1/requests/{id}/outputs/files` | HTTP 404 | confirmed missing for this successful path |
| Area/perimeter explicit request | query with `inputs.vector_ref` | HTTP 200 payload but `status=failed`; planner demands `threshold_raster` | confirmed failed |
| Real-estate ranking request | query with `inputs.vector_ref` | failed; demands raster capabilities | confirmed failed |
| Small inline raster NDVI request | query with inline 2-band raster | failed; demands `threshold_raster`, `raster_to_vector` | confirmed failed |
| LLM planner preview | `POST /api/v1/planner/intent` without provider URL | HTTP 400 provider configuration error | blocked by missing environment |
| Frontend startup/build | Vite on 5173 and browser DOM inspection | page loads; API shows Online | confirmed working |
| Frontend ↔ backend data discovery | browser AI Query workspace | uploads visible; 2 datasets available | confirmed working |
| Frontend project creation/details | browser Projects workspace | project created and detail route loaded | confirmed working |
| Frontend project selection for AI query | API response and active selector state trace | Phase 3C refreshes the list when AI Query is entered, parses the plain project list at the API boundary, and separates loading/empty/error states | corrected; browser re-verification pending local browser availability |
| Frontend run of direct vector phrase | browser submits dataset ID via `data_source_ids` | Phase 2 failed because the backend ignored the selection; Phase 3B normalization now binds one valid selected GeoJSON as `vector_ref` | superseded by the Phase 3B confirmed narrow slice |
| Docker Compose config/startup | `docker-compose config` | blocked because root `.env` missing; no containers started | blocked by prerequisite |

“Working” means that one observed path returned the expected immediate response. It does not establish production reliability, correctness of geospatial results, persistence across restart, or LLM/PostGIS behavior.

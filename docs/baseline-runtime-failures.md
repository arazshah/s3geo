# Phase 2 runtime failures

## Confirmed failures

1. **Legacy/routing capability resolution is incoherent with the loaded plugin inventory.**
   * Evidence: health lists `spectral_indices`, `raster_threshold`, `area_perimeter_calc`, and many other modules, all enabled; explicit area/perimeter, ranking, and inline NDVI requests instead fail with missing `threshold_raster`, `calculate_spectral_index`, and/or `raster_to_vector`.
   * Paths: [backend/orchestrator/query_execution_service.py](/home/araz/Projects/Career/s3geo/backend/orchestrator/query_execution_service.py), [backend/orchestrator/service.py](/home/araz/Projects/Career/s3geo/backend/orchestrator/service.py), plugin manifests under [backend/config/plugins](/home/araz/Projects/Career/s3geo/backend/config/plugins).
   * Consequence: a plugin reported as enabled is not evidence that user queries can resolve its required capability names.

2. **The frontend fails the only demonstrated map-producing query.**
   * Direct API success requires `inputs.vector_ref`; the AI workspace submits selected upload IDs as `data_source_ids`. The browser returned request `req-6ac9b5a4-a000-4e9e-9a7a-0e68f7dd8caa` with missing `calculate_spectral_index, threshold_raster` for the same phrase, `show vector features`.
   * Primary request client: [frontend/src/lib/api.ts](/home/araz/Projects/Career/s3geo/frontend/src/lib/api.ts:92). Backend request model/handling: [backend/api/routers/query.py](/home/araz/Projects/Career/s3geo/backend/api/routers/query.py), [backend/orchestrator/query_execution_service.py](/home/araz/Projects/Career/s3geo/backend/orchestrator/query_execution_service.py).
   * Consequence: the UI does not reach the proven working direct-vector contract, so map rendering cannot be demonstrated end-to-end.

3. **Project creation does not make a project selectable in AI Query.**
   * A project was created through `POST /api/v1/projects` and its detail route loaded in the UI, yet AI Query rendered a disabled selector with “No projects loaded.”
   * Consequence: project context is unavailable in the primary query workflow even though the Projects workspace can create and inspect projects.

4. **Successful direct-vector output lacks the file-manifest/download contract.**
   * The request returned GeoJSON/map layers, but `GET /api/v1/requests/{id}/outputs/files` returned 404.
   * Consequence: a visually useful successful response cannot be treated as a durable artifact or download workflow.

5. **Frontend CORS behavior is port-sensitive and undocumented operationally.**
   * Vite on 5174 reports API Offline; an Origin request receives no `Access-Control-Allow-Origin`. Vite on the allow-listed 5173 reports Online.
   * Cause evidence: hard-coded allowed origins in [backend/api/main.py](/home/araz/Projects/Career/s3geo/backend/api/main.py:48).
   * Consequence: local startup is fragile whenever Vite chooses or is configured for a non-default port.

6. **API test execution stalls.** See [baseline-test-results.md](baseline-test-results.md). The exact deadlock/blocking cause remains unverified.

## Confirmed blockers, not application defects

* Docker Compose did not start because `.env` is absent.
* LLM planner preview could not be tested because no LLM base URL/provider configuration was supplied.
* No PostGIS service or connection details were supplied.

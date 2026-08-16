# Phase 2 exercised execution paths

## A. Direct API vector-display path: successful

1. Upload `backend/data/austria_test/austria_candidate_areas.geojson` to `POST /api/v1/uploads/vector`.
2. Submit `POST /api/v1/query` with query `show vector features` and `inputs.vector_ref=<upload-id>`.
3. The service responded `status=succeeded`, `execution_mode=capability_bridge`, `legacy_handler_name=vector_display`, and a trace containing successful `inspect_vector` and `display_vector_layer` steps.
4. Response contained 3 polygon features, vector outputs, `layers`, `map_layers`, and `map` GeoJSON.
5. `GET /api/v1/requests/{request_id}/map-layers` returned two GeoJSON layers; `outputs/files` returned 404.

This confirms a narrow direct handler in the query execution service, not a general planner-backed operation pipeline. Relevant unit evidence is [backend/tests/test_vector_display_handler.py](/home/araz/Projects/Career/s3geo/backend/tests/test_vector_display_handler.py).

## B. Frontend UI vector-display path: failed

1. Start Vite with the local API URL on CORS-allowed port 5173.
2. AI Query discovers the uploaded dataset through the upload API.
3. Select the dataset, enter `show vector features`, and click Run Analysis.
4. UI submits its frontend request contract and receives a failed request with missing raster capability names instead of the direct-vector response.

The observed divergence is the frontend’s selected-dataset representation (`data_source_ids`) versus the successful backend direct-handler input (`inputs.vector_ref`). This is a confirmed behavior difference; whether a canonical normalization layer is intended but bypassed is unverified.

## C. Planner-backed/geospatial paths: failed under deterministic local settings

* area/perimeter (`inputs.vector_ref`) → missing `threshold_raster`
* real-estate ranking (`inputs.vector_ref`) → missing `calculate_spectral_index`, `threshold_raster`, `raster_to_vector`
* inline NDVI raster → missing `threshold_raster`, `raster_to_vector`

Every failure was returned as an HTTP 200 response containing a failed status/payload, rather than an HTTP error. Consumers must inspect application status, not HTTP status alone.

## D. Provider-dependent planning: blocked

The preview endpoint returned `400 OPENAI_BASE_URL or LLM_BASE_URL is not configured.` This verifies its configuration prerequisite, not prompt/tool execution.

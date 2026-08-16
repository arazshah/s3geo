# Vector display vertical-slice contract

## Supported user flow

1. Upload valid GeoJSON through `POST /api/v1/uploads/vector`.
2. Select one uploaded source in the AI Query workspace.
3. Submit the supported deterministic display phrase (for example, `show vector features`). The frontend sends `data_source_ids`, with legacy aliases retained in the request type.
4. The API normalizes the one selection to `inputs.vector_ref`, validates the upload metadata, and invokes the existing vector-display handler.
5. The response has `status=succeeded`, FeatureCollection GeoJSON, `layers`/`map_layers`, and output metadata. Leaflet renders it through the normal frontend response adapter.

The legacy `inputs.vector_ref` route remains supported and is authoritative. A multi-selection is an explicit 400 rather than an arbitrary dataset-order choice.

## Execution guarantee

When an input is a valid deterministic vector-display request, `QueryExecutionService.handle_query` bypasses optional LLM intent planning and marks `metadata.llm_planning_skipped="deterministic_vector_display"`. It then reaches the existing capability bridge (`inspect_vector`, `display_vector_layer`). This is an intentionally small reliability guarantee, not a claim that LLM or general planning is stable.

## Frontend response contract

`frontend/src/App.tsx` no longer unwraps every `result` object. A successful vector response uses `result` as an output field while retaining root `status`, `request_id`, `outputs`, and map-layer fields. The adapter now preserves that root response whenever those contract fields exist. `frontend/src/lib/api.ts` exposes FastAPI structured error messages instead of serializing their complete object as the user-facing error.

## Deliberate non-goals and known limitation

This slice does not select source/target/mask/raster roles, profile uploads, create reports, or repair generalized natural-language planning. Direct display still produces two semantically overlapping layers (`active_vector` and the named upload); Phase 3B verifies rendering but does not deduplicate that legacy output.

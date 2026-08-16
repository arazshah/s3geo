# Query request normalization (Phase 3B)

## Purpose and boundary

`POST /api/v1/query` now has one narrow normalization boundary in `backend/api/routers/query_planner.py` before `QueryExecutionService.handle_query`. It makes the frontend's selected-dataset request shape usable for the deterministic **vector-display** phrase only. It does not generalize role binding, QuerySpec planning, raster operations, or arbitrary natural-language queries.

## Accepted public shapes and precedence

| Priority | Public request field | Behaviour |
| --- | --- | --- |
| 1 | `inputs.vector_ref` | Authoritative legacy explicit binding. It is validated, and stale selected-dataset arrays are ignored. |
| 2 | `data_source_ids` | Canonical current frontend selection array. |
| 2 | `dataset_ids`, `datasets` | Compatibility aliases; combined with `data_source_ids`, de-duplicated in first-seen order. |

For a query recognized by `is_vector_display_query`, exactly one selected ID is required when no explicit `vector_ref` exists. The normalizer validates it against `UploadStorage`: metadata must say `kind=vector`, extension `.geojson` or `.json`, and `parsed_json_available=true`. It then creates the internal `inputs.vector_ref` expected by the existing resolver and vector handler.

For other queries, selections are deliberately left uninterpreted. That preserves the former permissive public envelope while making the unimplemented generalized role contract visible rather than silently guessing.

## Errors and observability

Validation failures are HTTP 400 responses with `detail.code`, a safe `detail.message`, and safe IDs in `detail.details`; storage paths and uploaded content are not returned. Codes are `input.dataset_selection_required`, `input.dataset_selection_invalid`, `input.dataset_selection_ambiguous`, `input.dataset_not_found`, `input.dataset_not_displayable_vector`, and the defensive `input.dataset_resolution_unavailable`.

For a material binding, `metadata.query_request_normalization` records the request shape, selected IDs, final vector ID, and precedence. Ordinary unselected requests receive no additional metadata, preserving the established API-contract fixture.

## Evidence and tests

Implementation: `backend/api/query_request_normalization.py`, called at `backend/api/routers/query_planner.py:398`. Regression coverage: `backend/tests/test_api_vector_display_dataset_selection.py`. The tests cover canonical frontend selection, legacy equivalence, explicit-reference precedence, clear failures, and the no-LLM deterministic path.

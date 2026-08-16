# Project selector contract (Phase 3C)

`GET /api/v1/projects` returns a plain JSON array. Each valid project record created by `POST /api/v1/projects` has at least `project_id` (stable ID) and `name` (display name), with optional `description`, timestamps, metadata, and relationship arrays.

The active AI Query client is `frontend/src/App.tsx`; it now loads projects whenever the AI Query view is entered. `frontend/src/lib/api.ts:normalizeProjectList` is the sole active frontend boundary for this list: it accepts the documented plain array and the explicit `{projects: [...]}` compatibility envelope, keeps only records with non-empty string `project_id` and `name`, and de-duplicates by ID. It does not recursively search arbitrary response objects.

The selector distinguishes loading, an empty successful list, and an API failure. A valid prior selection is retained; a missing selection is cleared. A newly returned project is never selected by list order. `project_id` remains optional on `/api/v1/query`; when present the query router validates it once through the existing project service, returns `400 input.project_not_found` for an unknown ID, and records safe acceptance metadata. Project context and `data_source_ids` are independent.

For a deterministic vector-display query, the public direct form `inputs.vector_ref` is authoritative. If it is absent, exactly one ID from `data_source_ids`, `dataset_ids`, or `datasets` is accepted as a compatibility selection and normalized once to the internal `vector_ref`. A missing selection, an unknown/non-GeoJSON vector, or multiple selections returns an existing structured `400` error; no list ordering or filename heuristic is used. The AI Query UI intentionally sends public selected-dataset IDs rather than internal plugin keys.

Projects are file-backed JSON records and can attach uploads, requests, outputs, and feedback. This phase does **not** infer dataset ownership or restrict global upload selection by project; attaching a dataset is an explicit existing operation.

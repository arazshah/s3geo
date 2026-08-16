# Frontend/backend contracts

## Confirmed request mismatch

Backend `QueryRequest` officially accepts `query`, `inputs`, `band_map`, `request_id`, `user_context`, `metadata`, `min_score`, and `project_id` (`api/routers/query_planner.py:19-61`). The frontend `GeoQueryRequest` primarily declares `datasets`, `dataset_ids`, `data_source_ids`, `context`, and `options` (`frontend/src/lib/api.ts:11-42`). Pydantic `extra="allow"` means fields are silently accepted but no backend code shown consumes most of them. Role hints in `context.input_roles` are not passed as `user_context` unless `App.buildGeoQueryRequest` duplicates them into metadata—this needs runtime contract testing.

The API exposes versioned and unversioned duplicates (`api/main.py:109-113`). Frontend retries 404/405 across both for health/query/preview (`api.ts:109-124,234-280`), obscuring route misconfiguration.

## Confirmed response mismatch

The backend `QueryResponse` declares objects/lists plus aliases (`query_planner.py:64-103`), but frontend types treat `confidence` as scalar and then recursively search arbitrary data for ranking/files/layers (`api.ts:44-76`; `utils/normalizers.ts`). API normalizes missing fields and frontend normalizes again. Thus a response can render while silently losing semantic distinctions or showing incorrect nested data.

## Consequences

There is no generated OpenAPI client, shared schema, compatibility/version policy, or fixture-backed end-to-end contract in the active build. The repository does contain named frontend API surface and response contract tests, but they were not executable in this environment.

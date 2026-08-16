# Phase 3B results: upload-to-map stabilization

## Outcome

The selected-upload → deterministic vector-display → map-layer path is now a tested frontend/backend contract. The implementation is constrained to that vertical slice; no dependency versions, Docker/CORS, generalized role inference, LLM configuration, or report pipeline were changed.

## Changes

- Added `backend/api/query_request_normalization.py` and explicit public selected-dataset fields on `QueryRequest`.
- Normalized one selected GeoJSON vector to the internal `inputs.vector_ref`; kept explicit `vector_ref` authoritative; return safe, clear 400 errors for missing, unknown, ambiguous, invalid, or non-vector selections.
- Bypassed LLM intent planning only for a valid deterministic vector-display request.
- Corrected the frontend's `result`-envelope detection so a successful vector response reaches Leaflet.
- Corrected structured FastAPI error extraction.
- Made the dependency-contract test parse PEP 508 requirements rather than compare raw pinned strings. This changes test logic only; manifests and installed dependency versions were not changed.

## Verification evidence

| Check | Result |
| --- | --- |
| Focused contract tests: `tests/test_query_response_frontend_contract.py tests/test_api_vector_display_dataset_selection.py tests/test_pyproject_dependency_contract.py` | 11 passed, 1 warning, 1.19s |
| Affected API/vector/dependency tests (earlier run) | 44 passed, 1 warning, 2.69s |
| Full-suite collection | 1,632 tests collected, 0.89s |
| Full Python suite, partitioned to avoid the execution bridge's 30-second output cutoff | **1,632 passed, 0 failed, 0 errors, 0 hangs/timeouts**: A–G 413 passed (3.71s); H–P 647 passed (21.91s); Q 26 passed (0.95s); R–Z 546 passed (15.59s). The sum matches collection exactly. |
| Frontend production build: `npm run build` | passed (Vite build completed) |
| Frontend lint: `npm run lint` | blocked by 37 pre-existing parser errors: multiple TSConfig roots caused by the duplicate `smart-spatial-frontend` tree and backup files |
| Manual browser flow against temporary localhost backend and Vite | uploaded `austria_candidate_areas.geojson`; selected it; `show vector features` succeeded; UI showed 2 visible map layers, 2 real GeoJSON sources, and a request ID |

The test client emits `StarletteDeprecationWarning` from `fastapi.testclient`'s re-export of `starlette.testclient`, advising that the installed `httpx`/Starlette compatibility path is future-sensitive. It is recorded but intentionally not changed: resolving it is a dependency-policy decision outside this slice. The four partitioned invocations report four instances of that warning plus the six existing Rasterio warnings; a one-process run previously reported one TestClient and six Rasterio warnings.

## Regression discovered and corrected during verification

The initial normalizer assumed every injected service had `upload_storage`, breaking `FakeQueryService` in `test_query_response_frontend_contract.py`. It now obtains the attribute defensively and requires it only for a request that actually needs upload validation. The normalizer metadata is also added only for material bindings, preserving the prior plain-query metadata contract.

## Cleanup

The manual localhost backend/Vite servers used an isolated temporary runtime directory and were stopped after verification. No production data, environment file, or dependency manifest was changed.

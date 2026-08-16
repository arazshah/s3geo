# Phase 2 baseline test results

## Automated test discovery

From `backend/`:

```bash
.venv/bin/python -m pytest --collect-only -q
```

Result: **1,628 tests collected**, exit 0, in 3.11 seconds. Pytest emitted one Starlette deprecation warning concerning `fastapi.testclient` and `httpx`.

## Executed test subsets

| Command | Result | Interpretation |
| --- | --- | --- |
| `pytest -q tests/test_upload_storage.py` | **6 passed** in 0.23s | isolated upload storage unit tests execute |
| `pytest -q tests/test_vector_display_handler.py` | **4 passed** in 0.03s | direct vector display handler unit tests execute |
| `pytest -q tests/test_api_mvp.py` | no test output after 30s; interrupted | API test module is not runnable to completion in this baseline |
| `pytest -q tests/test_api_mvp.py tests/test_api_uploads.py tests/test_api_outputs.py tests/test_vector_display_handler.py` | no test output after 60s; interrupted | mixed API subset does not yield progress |
| `pytest -q` | no visible test progress after more than four minutes; interrupted | full suite has no established passing baseline |

For diagnosis, `pytest -vv -s tests/test_api_mvp.py::test_api_health` collected one test and then stalled while executing `test_api_health`. This is a confirmed test-execution reliability problem; the root cause is **unverified** because the interrupted process produced no traceback.

## Frontend quality gates

| Command | Result |
| --- | --- |
| `npm run build` | **passed**: `tsc -b && vite build`; 1,794 modules; Vite warned that the JavaScript chunk is 688.68 kB (179.18 kB gzip), above 500 kB |
| `npm run lint` | **failed** with 37 parsing errors before linting source: `tsconfigRootDir` is ambiguous between `frontend/` and `frontend/smart-spatial-frontend/` |
| frontend test command | none declared in [frontend/package.json](/home/araz/Projects/Career/s3geo/frontend/package.json) |

The build demonstrates type/build compatibility but does not demonstrate behavior. The lint failure prevents it from serving as a source-quality gate.

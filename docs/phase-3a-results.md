# Phase 3A results: test-harness stabilization

## Scope outcome

No application, production, dependency, or test source files changed. The Phase 2 stall was diagnosed as execution-environment-specific, so a repository code change would have been unnecessary and unsafe. This phase added only diagnosis, classification, and execution guidance.

## Commands and results

| Command | Result |
| --- | --- |
| `.venv/bin/python -m pytest --collect-only -q` | 1,628 collected in 0.87s |
| sandboxed `timeout 45s ... pytest -vv -s tests/test_api_mvp.py::test_api_health` | timed out while calling `TestClient.get`; stack captured |
| normal-process `timeout 45s ... pytest -vv -s tests/test_api_mvp.py::test_api_health` | 1 passed in 0.62s |
| normal-process `timeout 120s ... pytest -q tests/test_api_mvp.py --tb=short` | 10 passed in 1.05s |
| normal-process `timeout 180s ... pytest -q tests/test_api_*.py --tb=short` | 32 passed in 2.25s |
| normal-process `timeout 600s ... pytest -q --tb=short` | 1,627 passed, 1 failed, 0 skipped, 0 errors, 0 timeouts in 41.14s |

The full suite emitted seven warnings: one `TestClient` deprecation warning and six Rasterio `is_tiled` pending deprecation warnings.

## Remaining failure (not changed)

`tests/test_pyproject_dependency_contract.py::test_optional_dependencies_cover_geo_pdf_and_postgis_imports` fails because it compares the literal string `"numpy"` with the declared, pinned requirement `"numpy==1.26.4"` in [pyproject.toml](/home/araz/Projects/Career/s3geo/backend/pyproject.toml:65). The package is present; the assertion's requirement-name parsing is incomplete. This is unrelated to the Phase 3A stall and was intentionally not fixed.

## Regression protection

The passing bounded API module and full-suite commands establish the regression baseline. A repository test cannot reliably reproduce an agent-execution sandbox restriction without coupling the project to a specific tool runtime, so no artificial regression test was added.

## Process cleanup and diff

All test commands were bounded and exited; no application server, pytest process, generated runtime data, `.env`, secret, or upload was left running/included. The only intended changes are the four Phase 3A documents and the confirmed-runtime-fact update to `PROJECT_CONTEXT.md`.

## Phase 3B readiness

**Yes, with one qualification.** The harness is reliable enough to begin Phase 3B when run in a normal local/CI process and with bounded diagnostics for new failures. Phase 3B should first address the single dependency-contract test assertion and the `TestClient` deprecation through an explicit dependency-policy decision, then stabilize the versioned frontend/backend request fixtures identified in Phase 2. It should not yet refactor execution pipelines or broaden geospatial behavior.

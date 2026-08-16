# Phase 3A test-harness diagnosis

## Conclusion

The Phase 2 API-test stall is **not reproduced in a normal local process**. It is caused by the restricted Codex execution sandbox interacting with FastAPI's in-process `TestClient` worker-thread dispatch. No repository application lifecycle, service construction, external provider, database, file lock, or test fixture was found to block.

The exact lower-level sandbox mechanism is **unverified**, but the boundary is confirmed by the following controlled reproductions on 2026-08-16.

| Reproduction | Sandbox result | Normal-process result |
| --- | --- | --- |
| `tests/test_api_mvp.py::test_api_health` | stalled at test call; stopped by 45-second external timeout | passed in 0.62s |
| Minimal `FastAPI` sync `/health` with `TestClient.get()` | stalled | not needed after real-test pass |
| Application construction through `OrchestratorService(...)` and `create_app(...)` | completed in under one second | completed |
| `tests/test_api_mvp.py` | stalls in sandbox | 10 passed in 1.05s |
| `tests/test_api_*.py` | not used as a sandbox gate | 32 passed in 2.25s |

## Execution trace

The first affected node is `tests/test_api_mvp.py::test_api_health` ([test_api_mvp.py](/home/araz/Projects/Career/s3geo/backend/tests/test_api_mvp.py:86)). Its `_client()` path constructs an `OrchestratorService`, calls `create_app`, creates `fastapi.testclient.TestClient`, then calls the synchronous `/health` endpoint.

The sandbox faulthandler capture, taken five seconds into the request, showed:

* caller thread: `starlette.testclient.handle_request` waiting in `anyio.from_thread.call`;
* portal thread: asyncio event loop waiting in `selectors.select`;
* no application service thread blocked in an LLM, database, filesystem, plugin import, or startup/shutdown handler.

The same sandbox behavior occurred with a minimal FastAPI app containing only a synchronous endpoint. App construction alone did not stall. In contrast, the same actual test passed outside the sandbox without code changes. That establishes the application-independent cause.

## Lifecycle and external-resource findings

* [api/main.py](/home/araz/Projects/Career/s3geo/backend/api/main.py:77) has no FastAPI lifespan handler; `create_app` is synchronous and completed.
* The test does not enter `TestClient` as a context manager, but no lifespan activity is configured, and normal execution completes.
* No configured LLM base URL, PostGIS service, browser, object store, or network resource was accessed by the passing API tests.
* Static inspection found only two test modules with external-client symbols: `test_geocoding_resolver.py` monkeypatches `urllib.request.urlopen`; `test_postgis_connector.py` installs a fake `psycopg` module. Neither makes a live service call in the tested paths.

## Correction decision

**No code correction was made.** Altering `TestClient`, disabling synchronous FastAPI dispatch, monkeypatching AnyIO, or pinning dependencies would hide or change a runtime behavior that works in the normal process. The smallest safe correction is procedural: run in-process API tests in an environment that permits loop-to-thread notifications, and retain an external process timeout as a guardrail.

The test warning remains relevant but is not the cause: FastAPI/Starlette emits a deprecation warning about `fastapi.testclient` and `httpx`. It completed successfully and must be addressed separately with a dependency-compatibility decision, not silently suppressed.

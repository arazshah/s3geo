# Phase 3A test-suite classification

## Inventory

`backend/tests/` contains **167 test modules** and `pytest --collect-only -q` collects **1,628 test nodes**. Existing markers are limited to `parametrize` and one `filterwarnings` use; there are no `unit`, `api`, `integration`, `external_service`, or `e2e` markers.

| Category | Existing tests | Classification basis | Local requirement |
| --- | --- | --- | --- |
| Unit | Most plugin, storage, model, parser, normalizer, configuration, and contract tests | direct function/class calls with temp files, fixtures, or fakes | Python dependencies only |
| API | 13 modules importing `fastapi.testclient.TestClient`, including `test_api_*.py`, frontend API contract, request-document, and response contract modules | in-process HTTP request/response assertions | dependencies plus a normal thread/event-loop process |
| Integration | 21 explicitly named `*_integration`, `test_end_to_end_natural_query_pipeline.py`, and `test_phase3_*` modules | multiple in-process services/plugins/stores wired together | Python/geo extras; no live service found |
| External-service | none currently identified | test code contains no live `requests`, `httpx`, `psycopg.connect`, or unmocked URL calls | not applicable |
| End-to-end | none in the browser/deployed-system sense | `test_end_to_end_natural_query_pipeline.py` is an in-process integration test, not browser or deployment E2E | not applicable |
| Unknown | none identified after static pass | all modules fit one of the above implementation-based categories | — |

## External-call evidence

The only external-client-style test references are mocked:

* [test_geocoding_resolver.py](/home/araz/Projects/Career/s3geo/backend/tests/test_geocoding_resolver.py) replaces `urllib.request.urlopen`.
* [test_postgis_connector.py](/home/araz/Projects/Career/s3geo/backend/tests/test_postgis_connector.py) installs a fake `psycopg` module.

The default local suite therefore made no uncontrolled real network calls in the observed run.

## Smallest marker proposal

Do not add markers merely to exclude tests: none of the current suite requires a live external service. When a real provider/database/browser test is deliberately added, introduce only these registered markers in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
markers = [
  "external_service: requires an explicitly configured live service",
  "e2e: requires a deployed system or browser",
]
```

The default local command should remain `pytest` and must exclude neither category until a marked test actually exists. A future CI job can run `-m external_service` only after it provisions its dependency and credentials.

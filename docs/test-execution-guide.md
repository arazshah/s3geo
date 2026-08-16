# Test execution guide

## Canonical local setup

From the repository root:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -e 'backend[dev,geo,pdf,postgis]'
cd backend
```

Do not supply LLM, PostGIS, or external-service credentials for the default suite. Existing tests use local fixtures/fakes for the external-client paths identified in [test-suite-classification.md](test-suite-classification.md).

## Commands

Use an external process bound while investigating a new failure; it reports a nonzero exit rather than leaving a test process running.

```bash
# Collection only
.venv/bin/python -m pytest --collect-only -q

# Fast API harness smoke
timeout 45s .venv/bin/python -m pytest -vv -s tests/test_api_mvp.py::test_api_health --tb=short

# API category
timeout 180s .venv/bin/python -m pytest -q tests/test_api_*.py --tb=short

# Largest local suite
timeout 600s .venv/bin/python -m pytest -q --tb=short
```

## Execution-environment requirement

`TestClient` tests must run in a normal local/CI process that permits asyncio loop-to-worker-thread wakeups. In the restricted Codex sandbox used during Phase 2 and reproduction, synchronous FastAPI requests can wait indefinitely in the AnyIO/Starlette in-process transport even for a minimal app. See [test-harness-diagnosis.md](test-harness-diagnosis.md).

This is not permission to use unbounded execution. Preserve the external timeout during investigation and record a timeout with its node ID and stack evidence. Do not solve the issue by skipping API tests, globally disabling startup, adding sleeps, or monkeypatching AnyIO.

## Interpretation

* Exit `0`: all selected tests passed.
* Exit `1`: test assertion/error; inspect and classify it. Do not relabel it as external-service without evidence.
* Exit `124`: the external timeout fired; collect verbose node/stage output and thread/task stacks before changing code.

The Phase 3A full-suite result is recorded in [phase-3a-results.md](phase-3a-results.md).

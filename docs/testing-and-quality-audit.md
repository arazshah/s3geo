# Testing and quality audit

## Confirmed test inventory

`backend/tests/` contains roughly 100 pytest files across API contracts, storage, routing, LLM normalization, planning/DAG/kernel parity, PostGIS, each major plugin, map/output/report/PDF paths, and naming/import-boundary contracts. This is substantial unit/contract test coverage by filename and inspected imports, but not proof of behavioral coverage, integration reliability, or production readiness.

## Execution result

`pytest -q` from `backend/` was attempted during this audit. It stopped during collection with 92 errors because the current environment lacks declared dependencies including `fastapi` and `pydantic`; no tests ran. This is a confirmed audit-environment failure, not a confirmed repository test failure. The Docker build would install dependencies, but Docker execution was not performed.

## Quality weaknesses

- Tests target private helpers and source/import boundary contracts extensively (e.g. `test_*_boundary_contract`), coupling refactoring to implementation shape.
- No verified browser E2E, deployment smoke, real provider integration, load/concurrency, restart/recovery, security, or realistic geospatial fixture suite was observed.
- `.env.example` enables LLM and QuerySpec planning, yet deterministic/offline test behavior relies heavily on mocks/static LLM clients by design.
- The repo contains historical `.bak`/audit artifacts in source tree; no lint/test ignore policy for those artifacts is documented.

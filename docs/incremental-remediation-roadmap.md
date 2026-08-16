# Incremental remediation roadmap

1. **Baseline and safety (P0):** make one reproducible dev/test environment; publish correct Compose ports; add startup health that reports capability-import failures; prohibit tolerant silent registry omissions in production; retain all evidence.
2. **Contract stabilization (P0):** freeze `/api/v1` schemas; generate frontend client/types; remove response aliases/recursive extraction behind adapters; add golden API fixtures and browser E2E tests.
3. **Durability (P0):** persist requests/audits/jobs and artifact associations; make output writes transactional/atomic; preserve restart behavior; introduce retention/backup policy.
4. **Dataset correctness (P0):** create ingestion/profile pipeline for vector/raster formats, CRS, schema, geometry validity, extent, size, mime/content checks; version sources and reject unsupported formats before query.
5. **Planning correctness (P0):** establish operation input schemas and one role-binding service; require explicit roles or clarification for ambiguous multi-dataset operations; log all precedence decisions.
6. **Execution consolidation (P1):** choose one DAG executor; move direct workflows into typed capabilities; shadow/test legacy router and then remove it.
7. **LLM governance (P1):** pin provider/model/prompt versions; schema validate once; limit/remove semantic plan repairs; add retries/timeouts/cost limits/evals and human-readable plan approval for high-risk cases.
8. **Output/artifact service (P1):** formally version vector/raster/table/report artifacts; generate downloadable reports via a declared renderer dependency; test map/table semantics end-to-end.
9. **Operations/security (P1):** add authentication/authorization, secrets management, connection allowlists, audit logging, metrics/traces, rate/resource limits and isolation.

Do not start broad refactoring before phases 1–3 have tests/telemetry that prove parity.

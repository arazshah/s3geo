# Fragility and risk register

| Priority | Confirmed finding and evidence | Consequence |
|---|---|---|
| P0 | Request history is an in-memory dict (`service.py:554-560`); outputs/projects persist separately. | Request lookup, feedback, map layers and re-save outputs fail after restart. |
| P0 | Query path uses several mutually exclusive execution systems (`direct_query_dispatch.py:26-84`; `query_execution_service.py:1082-1194`). | Same product contract has inconsistent behavior/validation. |
| P0 | LLM planning is default-on, and plan mutations inject/repair operations (`.env.example`; `llm_spec_generator.py:780-847,1213+`). | Unpredictable execution and hard-to-audit provenance. |
| P0 | Role assignment is UI filename heuristic + fragmented backend precedence (`aiInputRoles.ts:146-279`; `planning_context.py:110-168`). | Incorrect source/target analysis can look successful. |
| P0 | Uploads are not profiled/validated at ingestion beyond JSON parse (`upload_storage.py:126-135`). | Invalid CRS/geometry/file content reaches runtime. |
| P1 | Capability registry uses tolerant imports (`service.py:455-458`). | Environment-dependent operation availability can be hidden. |
| P1 | Response contract has backend aliases plus recursive frontend discovery. | UI can misrepresent outputs; compatibility regressions are masked. |
| P1 | Local JSON stores and non-atomic write sequences (`upload_storage.py`, `project_store.py`, `output_storage.py`). | Corruption/races/partial state; unsuitable multi-instance scaling. |
| P1 | Compose publishes no ports while docs claim URLs. | Standard local deployment does not match documentation. |
| P1 | Tests cannot collect in audited environment due missing deps. | Baseline health is unverified. |
| P2 | PDF dependency is optional but omitted from Docker install extra. | Requested PDFs may fail at runtime. |
| P2 | Direct real-estate fallback imports a bridge then legacy modules (`domain_direct_response_handlers.py:43-135`). | Domain special cases bypass generic planning and complicate correctness. |
| P2 | Error policy varies: intent errors swallowed; plan errors converted to failed payload; persistence may fail late. | Clients cannot apply uniform retry/error logic. |

No conclusion here asserts data loss, security exploitability, or production incident; those require deployment/runtime evidence.

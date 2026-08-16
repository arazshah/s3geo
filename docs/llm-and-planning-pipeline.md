# LLM and planning pipeline

## Two LLM interactions

Intent planning is optional/best-effort (`LLM_PLANNING_ENABLED`): `llm_intent_planner.plan_intent_with_llm` posts a strict JSON prompt to `/chat/completions` and normalizes an intent schema (`backend/orchestrator/llm_intent_planner.py:30-90,93-160`). Its result only rewrites vegetation/vectorization queries (`llm_intent_adapter.py:27-67`); errors are swallowed in normal query execution (`query_execution_service.py:879-922`). `/planner/intent` exposes this intent-only call.

QuerySpec planning is separately enabled (`QUERY_SPEC_PLANNING_ENABLED`). `LLMQuerySpecGenerator.generate` uses `OpenAICompatibleLLMClient` (`llm_spec_generator.py:43-114,1896+`) to request a declarative QuerySpec; `build_llm_messages` embeds supported operation names, schema and semantic/PostGIS guidance (`:930-1078`). JSON is extracted permissively (`:117-182`), pre-normalized, parsed, normalized and repaired.

## Validation and mutation facts

The parser requires a nonempty goal and operation list (`llm_spec_generator.py:850-923`) and validates the QuerySpec contract before execution (`planning_execution.py:178`). Before/after parsing, code may coerce lists to mappings, repair database parameter placement, inject database operations, rewrite vector aliases, add default scoring/ranking, inject risk/report steps, and auto-inject PDF rendering (`llm_spec_generator.py:780-847,1213-2086`). These repairs are logged under metadata but can change execution beyond exact LLM output.

## Execution

The planning context exposes available inputs, only normalized source/target roles, response language, project ID, and semantic PostGIS candidates (`planning_context.py:171-292`). A registry-backed DAG runner executes fail-fast; optional kernel execution is off by default (`planning_execution.py:180-199`, `service.py:243-253`).

## Risks

No structured provider SDK, schema-constrained response enforcement beyond `response_format`, retry/backoff/circuit breaker, token budget, prompt versioning, model provenance, or evaluation dataset is evidenced. LLM failures are handled inconsistently: intent failures disappear, QuerySpec failures become responses, and legacy LLM gate does not enforce blocking.

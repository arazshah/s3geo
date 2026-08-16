# Request lifecycle

1. `App.tsx:2805-3243` builds a loose `GeoQueryRequest`, previews `/planner/intent`, or posts `/query`; it clears UI outputs before execution.
2. `api/routers/query_planner.py:310-403` validates only basic types, calls `OrchestratorService.handle_query`, then adds alias fields/defaults.
3. `QueryExecutionService.handle_query` (`smart_spatial_system/.../query_execution_service.py:1082-1194`) creates ID/metadata, performs best-effort LLM intent planning, checks system-status direct responses, resolves references, and calls dispatch.
4. `natural_query_execution.py:44-100` resolves `raster_ref`/`vector_ref`, then dispatches: real-estate preflight/direct handler; direct vector display; QuerySpec planning if enabled; otherwise legacy routing.
5. QuerySpec planning generates JSON, validates and executes a capability DAG (`planning_execution.py:130-201`); planning errors become a completed HTTP 200-style `status: failed` response (`query_execution_service.py:824-854`).
6. The legacy path is parser -> weighted keyword router -> plan -> plugin executor -> audit -> simple response (`routing_aware_natural_query_runner.py:39-131`). LLM gate results are recorded but do not block by default (`:58-61`).
7. Successful/failed records are remembered in an in-memory history service and may be persisted to output files; output persistence failure can turn an otherwise successful request into an error (`service.py:1267-1302`).

## Precedence and fallback facts

Special handlers precede QuerySpec and legacy routing. QuerySpec is enabled from `QUERY_SPEC_PLANNING_ENABLED` (default true in `.env.example`), so legacy routing is normally only reached when planning is disabled or returns `None`; planning exceptions produce a failed response rather than falling back (`:824-854`). Intent LLM errors are swallowed (`:879-922`), after which original query proceeds. Frontend preview failure creates a local draft plan (`App.tsx:2929-2985`) that is explicitly not backend execution.

## Consequences

Different queries of comparable intent can follow materially different semantics, validation, persistence, error, and output paths. This is confirmed code behavior, not merely inferred risk.

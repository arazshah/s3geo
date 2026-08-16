# Recommended target architecture

Adopt one explicit, versioned analysis-command pipeline:

`API command -> dataset catalog/profile -> deterministic role binding -> intent/plan proposal -> strict plan validation/policy -> durable job -> capability executor -> artifact service -> versioned result API`.

Use a relational database for projects, datasets, requests, plans, jobs, artifacts, and audit events; object storage for originals/derived files; an async worker queue for long GIS/LLM work. Persist immutable dataset versions, CRS/geometry/raster profiles, content hashes, provenance, and plan/LLM model-prompt identifiers. Use a single shared JSON Schema/OpenAPI-generated client for frontend and backend.

The LLM should propose only a typed declarative plan, never select unknown capabilities or supply unvalidated raw connection credentials. A deterministic planner/policy layer must resolve IDs and role bindings, enforce operation-specific type/CRS/precondition checks, emit required clarification rather than guessing, and preserve the exact submitted/proposed/normalized plan separately. Each operation should have a typed capability contract, resource limits, dependency declaration and stable artifact outputs.

Treat direct real-estate workflows as explicit domain plugins/workflows that implement the same command/result/artifact contracts rather than hidden pre-dispatch exceptions. Retire legacy routing only after comparable contract/evaluation coverage.

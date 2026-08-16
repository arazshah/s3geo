# Unknowns and open questions

- Which frontend is authoritative: `frontend/` (Docker target) or `frontend/smart-spatial-frontend/`? Code evidence establishes only the former as Docker-active.
- Which execution path is product-supported: real-estate direct handlers, QuerySpec DAG, legacy keyword router, or all? No product policy is documented.
- What deployment supplies the required environment/dependencies and whether Compose is overridden to expose ports is unverified.
- Which plugin YAML files are enabled in the runtime volume, and which capabilities successfully register, is unverified without startup inspection.
- What datasets, CRS rules, scale limits, browser rendering limits, and analysis accuracy SLAs are intended?
- Is raw PostGIS/WFS/URL access meant for untrusted users? Authentication, credential storage, SSRF/network egress policy and tenancy requirements are undocumented.
- Is Persian the required default response language or merely an MVP default (`service.py:241`)?
- Are reports/PDFs contractual outputs, and is WeasyPrint expected in deployment? Docker dependency configuration conflicts with that expectation.
- Is feedback-based router weighting allowed to influence production routing automatically, and what governance/audit is required?
- What should happen when roles are ambiguous: ask a user, use metadata, or execute a default? Present behavior varies.

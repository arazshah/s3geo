# Phase 2 baseline summary

## Reproducible state

The backend installs from source with all declared extras, starts locally, exposes health, registers **34 enabled plugins**, accepts GeoJSON uploads, and has **1,628 collected tests**. The active frontend installs and builds, but lint does not run because its TypeScript root configuration is ambiguous. Root Docker Compose cannot be rendered or started without a missing `.env` file.

## What works today

* Local API health and plugin inventory.
* Vector uploads and upload listing.
* Project creation/detail in the Projects UI.
* Direct API vector display when callers provide `inputs.vector_ref`.
* Frontend/API health and dataset discovery on port 5173.

## What does not establish a reliable product

* The representative frontend query fails even for the direct-vector phrase that succeeds through the API because request shapes differ.
* Explicit area/perimeter, ranking, and inline raster attempts fail in a server that reports relevant plugins enabled.
* A successful direct display does not produce file artifacts.
* Project context does not flow from the project workspace into the query workspace.
* API tests stall during execution; no full test pass rate is known.
* LLM, PostGIS, Compose startup, PDF rendering, and true map rendering of a backend result are not verified under available prerequisites.

## Recommended next gate (no implementation in Phase 2)

Before changing architecture, define canonical request/response fixtures for vector display, project-scoped source selection, a raster operation, ranking, and artifact output. Run them through both direct HTTP and UI automation, then make the test suite deterministic enough to provide a pass/fail baseline.

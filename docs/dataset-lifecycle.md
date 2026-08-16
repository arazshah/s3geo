# Dataset lifecycle

## Storage and loading facts

Uploads enter `/uploads/vector` or `/uploads/raster` (`api/routers/uploads.py:22-95`) and are written as `uploads/upl-*/<safe filename>` plus `metadata.json` (`upload_storage.py:88-167`). Allowed extensions include JSON/GeoJSON/TIFF/GPKG/ZIP/SHP/KML/CSV/TSV; maximum is 100 MiB (`:43-57`). Only JSON parsing is performed at upload time (`:126-135`): no durable geometry/raster profile, CRS validation, malware scan, or dataset fingerprint beyond SHA-256 is confirmed.

`UploadReferenceResolver.resolve_inputs` recognizes only generic `raster_ref` and `vector_ref`/certain object forms (`input_reference_resolver.py:112-146`). It attempts configured loader plugins and permits JSON fallback (`service.py:517-527`). Non-JSON formats can be stored but executable support depends on loader/plugin availability.

Projects are file-backed `project.json` relation lists (`project_store.py:60-89`); attaching an upload merely records its ID (`service.py:1001-1005`). Deleting a data source removes the upload directory; relationship cleanup must be verified in `DataSourceService` and is not an invariant visible in `ProjectStore`.

External WFS/PostGIS routes fetch data then serialize FeatureCollection JSON and re-save it as uploads (`data_source_connectors.py:131-211`, `:259-339`). CSV/WMS are metadata registrations. This creates a snapshot, not an observed live connection lifecycle.

## Input roles

For QuerySpec nearest planning, backend precedence is: resolved direct `inputs.source/target`; `user_context` then metadata `input_roles`; `user_context` then metadata `role_bindings`; then context/metadata data-source `role` fields (`planning_context.py:110-168`). Only source/target are normalized there. The UI separately detects proximity and assigns source/target from filenames/titles, with dataset order as tie-breaker (`frontend/src/lib/aiInputRoles.ts:146-185,215-279`). Other roles (mask/raster/reference/boundary) have no equivalent documented global resolver.

## Risk

The same selected datasets can be bound differently by frontend heuristics, direct inputs, metadata, LLM aliases, or operation-specific maps. There is no canonical dataset catalog/profile service nor explicit user role confirmation in the audited path.

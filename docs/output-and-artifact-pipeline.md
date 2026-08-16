# Output and artifact pipeline

The normal response builder gathers internal `layers`, map, documents, reports, artifacts, files, trace and steps (`production_response.py:249-344`). The API then aliases layers as `layers`, `map_layers`, and `map.layers` (`query_planner.py:157-174`).

`MapLayerBuilder` builds Leaflet-ready layers from request records; `MapLayerService` serves them through `/requests/{id}/map-layers` (`service.py:484-488,1304-1311`). The frontend maps permissively: it searches recursively for GeoJSON/layer-like fields and, failing a layer list, invents a "Backend GeoJSON Result" layer (`frontend/src/utils/normalizers.ts:198-293`, `utils/geojson.ts:128-184`). `MapView.tsx` renders Leaflet layers and fetches `sourceUrl` when supplied.

Outputs are serialized in `OutputStorage.save_request_record` (`output_storage.py:74-269`): response, audit, summary, metadata, map layers, FeatureCollection layer GeoJSON, lightweight run result, contract and manifest. Files are JSON/GeoJSON first; `output_storage.py:17-23` calls TIFF/COG/MBTiles/object storage future work. It is not an atomic transaction and output persistence failure is surfaced after record creation (`service.py:1293-1302`).

Reports are structured by `plugins/report_builder.py` then rendered by `plugins/pdf_renderer.py` using Jinja and optionally WeasyPrint. Report document download only permits a filename containing request ID under reports runtime path (`api/routers/requests_outputs.py:383-430`, `service.py:1187-1240`). Whether the normal QuerySpec path actually produces a physical PDF depends on plugin runtime/dependencies and requested output—unverified without a configured runtime.

Ranking table display is frontend heuristic extraction from several names (`normalizers.ts:118-195`), not a backend versioned table schema.

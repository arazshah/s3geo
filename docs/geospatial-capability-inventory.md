# Geospatial capability inventory

The canonical logical operation catalog is `backend/orchestrator/planning/op_catalog.py:95-1008`; its descriptors map logical operation -> plugin capability -> input map/type -> output type. The plugin list registered by default is `orchestrator/plugin_modules.py:14-49`; modules imported tolerantly may be absent at runtime.

| Group | Operations and required logical inputs | Declared output |
|---|---|---|
| Loading/connectors | `load_vector` (path); `query_database`/`load_postgis_layer` (connection/table params) | vector |
| Filter/selection | `filter_attribute`, `sort_limit` (vector) | vector |
| Proximity | `spatial_nearest`/`nearest_neighbor` (source,target); `filter_by_distance` (vector,reference); `distance_to` (vector,target) | vector |
| Overlay | `filter_points_in_polygon` (vector,polygon); `intersect`/`spatial_join` (source,target); `buffer` (vector) | vector |
| Raster | `raster_stats` (raster); `ndvi`/`calculate_ndvi` (raster); `ndvi_from_bands` (red_band,nir_band); `spectral_index`, `band_math`, `raster_threshold`, `raster_reclassify`, `raster_clip` (raster + mask for clip); `raster_to_vector` (raster); `slope_aspect` (raster); `zonal_statistics` (raster,zones) | raster/vector/json as catalog declares |
| Feature/ranking | `score_features`, `rank_features`, `top_n`, `enrich_feature_properties`, `join_feature_properties`, `enrich_risk` (vector) | vector |
| Inspection/output | `inspect_vector`, `summarize_vector` (vector); `display_vector` (vector); `export_geojson` (vector); `build_report` (ranked vector); `render_pdf` (report) | json/map/vector/report/pdf |

Catalog aliases are not necessarily distinct implementations. More plugin capabilities exist outside the catalog (e.g., WMS/WFS, loaders, geometry validation, CRS transform, area/perimeter, centroid, attribute statistics); absence from `OP_CATALOG` means an LLM QuerySpec cannot select them unless another path handles them. Exact capability argument validation is implemented per plugin/config YAML and must be treated as the executable contract.

Distance notes in catalog explicitly require a projected/metric CRS for meters (`op_catalog.py:227-250,392-407`), but no global CRS policy is enforced before routing.

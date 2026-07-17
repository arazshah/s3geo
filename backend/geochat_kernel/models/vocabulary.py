# geochat_kernel/models/vocabulary.py
"""
Canonical vocabulary for GeoChatV2 Kernel.

DESIGN: all domain-classification fields on models are OPEN strings, never
closed Literals/Enums. These StrEnums only define the canonical ("blessed")
values shared by the kernel and first-party plugins. Plugins may introduce
new values without modifying the kernel (decision from Q2/Q-vocab).
"""

from __future__ import annotations

from enum import StrEnum


class QueryIntent(StrEnum):
    LOCATE = "locate"
    NEARBY = "nearby"
    NEAREST = "nearest"
    WITHIN = "within"
    ROUTE = "route"
    COMPARE = "compare"
    COUNT = "count"
    AGGREGATE = "aggregate"
    ANALYZE = "analyze"          # spatial analysis (flood, fire, site-selection)
    SIMULATE = "simulate"
    FILTER = "filter"
    SEARCH = "search"
    UNKNOWN = "unknown"


class EntityRole(StrEnum):
    TARGET = "target"
    ANCHOR = "anchor"
    SECONDARY_TARGET = "secondary_target"
    ORIGIN = "origin"
    DESTINATION = "destination"
    WAYPOINT = "waypoint"
    VIA = "via"
    AREA = "area"
    BOUNDARY = "boundary"
    REGION = "region"
    CONSTRAINT = "constraint"
    FILTER = "filter"
    EXCLUSION = "exclusion"
    CONTEXT = "context"
    MODIFIER = "modifier"
    ATTRIBUTE = "attribute"
    QUANTITY = "quantity"
    TIME = "time"
    UNIT = "unit"
    PHENOMENON = "phenomenon"    # e.g. "flood", "fire" as an analyzable subject
    UNKNOWN = "unknown"


class RelationKind(StrEnum):
    NEARBY = "nearby"
    NEAREST = "nearest"
    WITHIN = "within"
    WITHIN_WALKING = "within_walking"
    WITHIN_DRIVING = "within_driving"
    CONTAINS = "contains"
    CONTAINED_BY = "contained_by"
    INTERSECTS = "intersects"
    OVERLAPS = "overlaps"
    TOUCHES = "touches"
    DISJOINT = "disjoint"
    NORTH_OF = "north_of"
    SOUTH_OF = "south_of"
    EAST_OF = "east_of"
    WEST_OF = "west_of"
    ADJACENT = "adjacent"
    BETWEEN = "between"
    ALONG = "along"
    ROUTE = "route"
    SHORTEST_PATH = "shortest_path"
    FASTEST_PATH = "fastest_path"
    REACHABLE = "reachable"
    COMPARE = "compare"
    COUNT = "count"
    AGGREGATE = "aggregate"
    DENSITY = "density"
    LOCATE = "locate"
    SEARCH = "search"
    UNKNOWN = "unknown"


class GeometryHint(StrEnum):
    POINT = "point"
    LINE = "line"
    POLYGON = "polygon"
    MULTIPOINT = "multipoint"
    MULTILINE = "multiline"
    MULTIPOLYGON = "multipolygon"
    GEOMETRY_COLLECTION = "geometry_collection"
    UNKNOWN = "unknown"


class KnownStepType(StrEnum):
    """Canonical step types. OPEN: plugins may define custom step types."""

    FETCH_VECTOR = "fetch_vector"
    FETCH_RASTER = "fetch_raster"
    GEOCODE = "geocode"
    REVERSE_GEOCODE = "reverse_geocode"
    SPATIAL_JOIN = "spatial_join"
    BUFFER = "buffer"
    ZONAL_STATS = "zonal_stats"
    TEMPORAL_FILTER = "temporal_filter"
    UNION = "union"
    INTERSECTION = "intersection"
    AGGREGATE = "aggregate"
    CLASSIFY = "classify"
    SCORE = "score"
    RUN_MODEL = "run_model"            # ML / risk model
    EXTERNAL_API_CALL = "api_call"
    REMOTE_COMPUTE = "remote_compute"  # e.g. GEE (decision from Q15)
    RENDER_GRID = "render_grid"
    BUILD_LAYER = "build_layer"
    ROUTE = "route"
    ISOCHRONE = "isochrone"


class KnownSourceType(StrEnum):
    """Canonical source categories. OPEN: plugins may define custom ones."""

    VECTOR = "vector"
    RASTER = "raster"
    CLOUD_RASTER = "cloud_raster"
    EXTERNAL_API = "external_api"
    TABULAR = "tabular"
    KNOWLEDGE_GRAPH = "knowledge_graph"
    VECTOR_DB = "vector_db"
    TILE_SERVER = "tile_server"
    STAC = "stac"
    OGC_SERVICE = "ogc_service"        # WMS/WFS/WCS
    SENSOR_STREAM = "sensor_stream"
    SIMULATION = "simulation"
    ML_ENDPOINT = "ml_endpoint"
    HYBRID = "hybrid"


class KnownStorageFormat(StrEnum):
    """Canonical formats. OPEN: plugins may define custom ones."""

    SQLITE = "sqlite"
    POSTGRES = "postgres"
    GEOTIFF = "geotiff"
    GEOPACKAGE = "geopackage"
    GEOJSON = "geojson"
    NETCDF = "netcdf"
    HDF5 = "hdf5"
    GRIB = "grib"
    COG = "cog"
    EARTH_ENGINE_ASSET = "earth_engine_asset"
    REST_API = "rest_api"
    MEMORY = "memory"


class ResponseStatus(StrEnum):
    """Now a StrEnum for consistency (fixes prior models inconsistency)."""

    SUCCESS = "success"
    PARTIAL = "partial"
    EMPTY = "empty"
    AMBIGUOUS = "ambiguous"
    ERROR = "error"
    TIMEOUT = "timeout"
    UNSUPPORTED = "unsupported"


class ArtifactKind(StrEnum):
    """Kinds of user-facing artifacts (decision from Q19). OPEN set."""

    FEATURES = "features"
    MAP_LAYER = "map_layer"
    RASTER_REF = "raster_ref"
    TABLE = "table"
    CHART = "chart"
    REPORT = "report"
    ROUTE = "route"
    ISOCHRONE = "isochrone"
    DOWNLOAD = "download"
    SCALAR = "scalar"


class HookPoint(StrEnum):
    """
    All pipeline hook points (decision from Q4-final).

    MVP activates only ON_QUERY_PARSED and ON_RESPONSE_COMPOSED, but the full
    set is defined now so plugins can target future extension points.
    """

    BEFORE_PARSE = "before_parse"
    ON_QUERY_PARSED = "on_query_parsed"          # MVP active
    AFTER_SEMANTIC_ENRICH = "after_semantic_enrich"
    BEFORE_PLAN = "before_plan"
    AFTER_PLAN = "after_plan"
    BEFORE_EXECUTE = "before_execute"
    AFTER_STEP = "after_step"
    AFTER_EXECUTE = "after_execute"
    AFTER_FUSION = "after_fusion"
    AFTER_RANK = "after_rank"
    ON_RESPONSE_COMPOSED = "on_response_composed"  # MVP active
    ON_ERROR = "on_error"


class ComponentKind(StrEnum):
    """Kinds of components a plugin can register (decision from Q6). OPEN set."""

    PARSE_STAGE = "parse_stage"
    QUERY_PARSER = "query_parser"
    SEMANTIC_ENRICHER = "semantic_enricher"
    SEMANTIC_TYPE = "semantic_type"
    PLANNER = "planner"
    PLAN_OPTIMIZER = "plan_optimizer"
    STEP_HANDLER = "step_handler"
    PROVIDER = "provider"
    TOOL = "tool"
    LLM = "llm"
    RANKER = "ranker"
    FUSION = "fusion"
    ARTIFACT_BUILDER = "artifact_builder"
    COMPOSER = "composer"
    CACHE = "cache"


class Permission(StrEnum):
    """Plugin permissions (decision from Q22/Q24). Enforced later; declared now."""

    NETWORK = "network"
    FILESYSTEM = "filesystem"
    LLM = "llm"
    USER_LOCATION = "user_location"
    SENSITIVE_DATA = "sensitive_data"
    REMOTE_EXECUTION = "remote_execution"
    DATABASE = "database"
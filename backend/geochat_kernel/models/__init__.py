# geochat_kernel/models/__init__.py
from __future__ import annotations

from geochat_kernel.models.analytics import (
    AnalyticsResult,
    HistogramBin,
    ScalarMetric,
    SpatialAggregation,
    TabularData,
)
from geochat_kernel.models.artifact import GeoArtifact
from geochat_kernel.models.audit import AuditRecord
from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.capability import (
    CapabilityDescriptor,
    CostHint,
)
from geochat_kernel.models.datasource import (
    DataSourceDescriptor,
    SourceCapabilities,
)
from geochat_kernel.models.entity import Entity
from geochat_kernel.models.error_info import ErrorInfo
from geochat_kernel.models.execution_artifact import ExecutionArtifact
from geochat_kernel.models.geo_feature import (
    DisplayInfo,
    GeoFeature,
    SpatialMetrics,
    StructuredAddress,
)
from geochat_kernel.models.geo_geometry import (
    GeoBoundingBox,
    GeoGeometry,
    GeoPoint,
)
from geochat_kernel.models.geo_response import (
    ExecutionInfo,
    FeatureGroup,
    GeoResponse,
    PaginationInfo,
    UserMessage,
)
from geochat_kernel.models.route_decision import (
    CostInfo,
    RouteDecision,
    RoutedCapability,
    RoutingStrategy,
)
from geochat_kernel.models.job import (
    AsyncJobRef,
    JobProgress,
    JobStatus,
)
from geochat_kernel.models.interpretation import (
    InterpretationLayer,
    RawSegment,
)
from geochat_kernel.models.manifest import PluginManifest
from geochat_kernel.models.map_layer import MapLayer, MapStyle
from geochat_kernel.models.query_ir import (
    AmbiguityInfo,
    BoundingBox,
    ParserInfo,
    QueryConstraints,
    QueryIR,
    TimeRange,
)
from geochat_kernel.models.query_plan import PlanStep, QueryPlan
from geochat_kernel.models.raster import RasterBand, RasterRef, RasterStats
from geochat_kernel.models.spatial_relation import SpatialRelation
from geochat_kernel.models.statistics import (
    CapabilityStatistics,
    StatisticsSnapshot,
)
from geochat_kernel.models.tool_result import ToolResult
from geochat_kernel.models.trace import (
    ExecutionTrace,
    TraceEvent,
    TraceStatus,
    TraceStep,
)
from geochat_kernel.models.vocabulary import (
    ArtifactKind,
    ComponentKind,
    EntityRole,
    GeometryHint,
    HookPoint,
    KnownSourceType,
    KnownStepType,
    KnownStorageFormat,
    Permission,
    QueryIntent,
    RelationKind,
    ResponseStatus,
)

__all__ = [
    # base
    "KernelModel",
    # error / result
    "ErrorInfo",
    "ToolResult",
    # vocabulary
    "QueryIntent",
    "RelationKind",
    "EntityRole",
    "GeometryHint",
    "KnownStepType",
    "KnownSourceType",
    "KnownStorageFormat",
    "ResponseStatus",
    "ArtifactKind",
    "HookPoint",
    "ComponentKind",
    "Permission",
    # query understanding
    "Entity",
    "SpatialRelation",
    "RawSegment",
    "InterpretationLayer",
    "QueryIR",
    "QueryConstraints",
    "ParserInfo",
    "AmbiguityInfo",
    "BoundingBox",
    "TimeRange",
    # datasource / planning / execution
    "DataSourceDescriptor",
    "SourceCapabilities",
    "QueryPlan",
    "PlanStep",
    "ExecutionArtifact",
    # geometry / features
    "GeoPoint",
    "GeoBoundingBox",
    "GeoGeometry",
    "GeoFeature",
    "StructuredAddress",
    "SpatialMetrics",
    "DisplayInfo",
    # raster / map
    "RasterRef",
    "RasterBand",
    "RasterStats",
    "MapLayer",
    "MapStyle",
    # analytics
    "AnalyticsResult",
    "ScalarMetric",
    "TabularData",
    "SpatialAggregation",
    "HistogramBin",
    # response
    "GeoResponse",
    "FeatureGroup",
    "PaginationInfo",
    "ExecutionInfo",
    "UserMessage",
    "GeoArtifact",
    # trace / audit
    "ExecutionTrace",
    "TraceStep",
    "TraceEvent",
    "TraceStatus",
    "AuditRecord",
    # statistics
    "CapabilityStatistics",
    "StatisticsSnapshot",
    # job
    "AsyncJobRef",
    "JobStatus",
    "JobProgress",
    # routing
    "RouteDecision",
    "RoutedCapability",
    "RoutingStrategy",
    "CostInfo",
    # plugin / capability
    "CapabilityDescriptor",
    "CostHint",
    "PluginManifest",
]

# geochat_kernel/models/geo_response.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.analytics import AnalyticsResult
from geochat_kernel.models.artifact import GeoArtifact
from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.datasource import DataSourceDescriptor
from geochat_kernel.models.geo_feature import GeoFeature
from geochat_kernel.models.map_layer import MapLayer
from geochat_kernel.models.raster import RasterRef
from geochat_kernel.models.trace import ExecutionTrace
from geochat_kernel.models.vocabulary import ResponseStatus


class FeatureGroup(KernelModel):
    """A named group of features for layered/organized display."""

    id: str
    label: str | None = None
    semantic_type: str | None = None
    features: list[GeoFeature] = Field(default_factory=list)

    display_color: str | None = None
    display_icon: str | None = None

    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def count(self) -> int:
        return len(self.features)


class PaginationInfo(KernelModel):
    """Pagination metadata for large result sets."""

    total: int = 0
    offset: int = 0
    limit: int | None = None
    has_more: bool = False


class ExecutionInfo(KernelModel):
    """
    Metadata about how this response was produced.

    Strategy is intentionally gone. The vNext architecture uses Planner +
    PlanExecutor + StepHandlers.
    """

    planner_name: str | None = None
    fusion_name: str | None = None
    composer_name: str | None = None

    provider_name: str | None = None
    dataset_id: str | None = None

    execution_time_ms: float | None = None
    provider_time_ms: float | None = None

    cache_hit: bool = False
    fallback_used: bool = False
    partial: bool = False

    metadata: dict[str, Any] = Field(default_factory=dict)


class UserMessage(KernelModel):
    """Human-readable messages for the UI layer."""

    summary: str | None = None
    clarification_request: str | None = None
    suggestion: str | None = None
    error_explanation: str | None = None


class GeoResponse(KernelModel):
    """
    Final output of GeoChatV2 pipeline.

    Multi-artifact response (Q19):
    - features/groups for vector results
    - analytics for metrics/tables/aggregations
    - raster_refs for raster outputs (Ref + Basic Stats)
    - map_layers for lightweight map rendering contract
    - artifacts for any user-facing output envelope
    - trace for explainability/observability (Q25)
    """

    id: str = Field(default_factory=lambda: f"res_{uuid4().hex}")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # traceability
    request_id: str | None = None
    query_ir_id: str | None = None
    plan_id: str | None = None
    session_id: str | None = None

    # status
    status: str = Field(default=ResponseStatus.SUCCESS)

    # core vector content
    features: list[GeoFeature] = Field(default_factory=list)
    groups: list[FeatureGroup] = Field(default_factory=list)

    # analytical content
    analytics: AnalyticsResult | None = None

    # multi-artifact / map outputs
    raster_refs: list[RasterRef] = Field(default_factory=list)
    map_layers: list[MapLayer] = Field(default_factory=list)
    artifacts: list[GeoArtifact] = Field(default_factory=list)

    # data lineage
    sources_used: list[DataSourceDescriptor] = Field(default_factory=list)

    # counts
    total_matched: int = 0
    returned: int = 0

    # pagination
    pagination: PaginationInfo = Field(default_factory=PaginationInfo)

    # execution metadata
    execution_info: ExecutionInfo = Field(default_factory=ExecutionInfo)

    # human-readable messages
    user_message: UserMessage = Field(default_factory=UserMessage)

    # trace / explainability
    trace: ExecutionTrace | None = None

    # errors and warnings
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    report_steps: list[str] = Field(default_factory=list)

    # extension
    metadata: dict[str, Any] = Field(default_factory=dict)

    # ------------------------------------------------------------------ #
    # Factory methods                                                      #
    # ------------------------------------------------------------------ #

    @classmethod
    def success(
        cls,
        *,
        features: list[GeoFeature] | None = None,
        query_ir_id: str | None = None,
        request_id: str | None = None,
        **kwargs: Any,
    ) -> "GeoResponse":
        items = list(features or [])
        return cls(
            status=ResponseStatus.SUCCESS,
            features=items,
            total_matched=len(items),
            returned=len(items),
            query_ir_id=query_ir_id,
            request_id=request_id,
            **kwargs,
        )

    @classmethod
    def empty(
        cls,
        *,
        query_ir_id: str | None = None,
        request_id: str | None = None,
        **kwargs: Any,
    ) -> "GeoResponse":
        return cls(
            status=ResponseStatus.EMPTY,
            features=[],
            total_matched=0,
            returned=0,
            query_ir_id=query_ir_id,
            request_id=request_id,
            **kwargs,
        )

    @classmethod
    def error(
        cls,
        message: str,
        *,
        query_ir_id: str | None = None,
        request_id: str | None = None,
        errors: list[str] | None = None,
        **kwargs: Any,
    ) -> "GeoResponse":
        return cls(
            status=ResponseStatus.ERROR,
            features=[],
            errors=list(errors or [message]),
            query_ir_id=query_ir_id,
            request_id=request_id,
            **kwargs,
        )

    @classmethod
    def ambiguous(
        cls,
        clarification_request: str,
        *,
        query_ir_id: str | None = None,
        request_id: str | None = None,
        **kwargs: Any,
    ) -> "GeoResponse":
        return cls(
            status=ResponseStatus.AMBIGUOUS,
            features=[],
            user_message=UserMessage(
                clarification_request=clarification_request,
            ),
            query_ir_id=query_ir_id,
            request_id=request_id,
            **kwargs,
        )

    # ------------------------------------------------------------------ #
    # Accessors / serialization helpers only                               #
    # ------------------------------------------------------------------ #

    @property
    def is_success(self) -> bool:
        return self.status == ResponseStatus.SUCCESS

    @property
    def is_empty(self) -> bool:
        has_no_features = len(self.features) == 0
        has_no_analytics = self.analytics is None or self.analytics.is_empty
        has_no_artifacts = (
            len(self.raster_refs) == 0
            and len(self.map_layers) == 0
            and len(self.artifacts) == 0
        )
        return self.status == ResponseStatus.EMPTY or (
            has_no_features and has_no_analytics and has_no_artifacts
        )

    @property
    def is_error(self) -> bool:
        return self.status == ResponseStatus.ERROR

    @property
    def is_ambiguous(self) -> bool:
        return self.status == ResponseStatus.AMBIGUOUS

    @property
    def has_groups(self) -> bool:
        return len(self.groups) > 0

    @property
    def has_analytics(self) -> bool:
        return self.analytics is not None and not self.analytics.is_empty

    @property
    def has_map_layers(self) -> bool:
        return len(self.map_layers) > 0

    @property
    def has_artifacts(self) -> bool:
        return (
            len(self.artifacts) > 0
            or len(self.map_layers) > 0
            or len(self.raster_refs) > 0
        )

    def get_features_by_type(self, semantic_type: str) -> list[GeoFeature]:
        return [f for f in self.features if f.semantic_type == semantic_type]

    def as_geojson_feature_collection(self) -> dict[str, Any]:
        """Serialization helper for map rendering."""
        return {
            "type": "FeatureCollection",
            "features": [f.as_geojson_feature() for f in self.features],
            "properties": {
                "total_matched": self.total_matched,
                "returned": self.returned,
                "status": self.status,
                "query_ir_id": self.query_ir_id,
                "has_analytics": self.has_analytics,
                "has_artifacts": self.has_artifacts,
            },
        }

    def add_error(self, message: str) -> None:
        self.errors.append(message)

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)

    def add_report_step(self, step: str) -> None:
        self.report_steps.append(step)

    def add_artifact(self, artifact: GeoArtifact) -> None:
        self.artifacts.append(artifact)

    def add_map_layer(self, layer: MapLayer) -> None:
        self.map_layers.append(layer)

    def add_raster_ref(self, raster_ref: RasterRef) -> None:
        self.raster_refs.append(raster_ref)

# geochat_kernel/models/analytics.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class ScalarMetric(KernelModel):
    """A single calculated metric, e.g. {'mean_ndvi': 0.64}."""

    name: str
    value: float | int | str
    unit: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TabularData(KernelModel):
    """Tabular analytical result (comparison tables, time-series, etc.)."""

    columns: list[str]
    rows: list[list[Any]]
    title: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def row_count(self) -> int:
        return len(self.rows)


class HistogramBin(KernelModel):
    min_val: float
    max_val: float
    count: int


class SpatialAggregation(KernelModel):
    """
    Spatial aggregation result (zonal statistics, heatmap grid, etc.).

    Values are carried by the kernel; computation is done by plugins.
    """

    zone_id_field: str | None = Field(
        default=None,
        description="Field identifying vector zones (e.g. 'neighbourhood_id').",
    )
    metric_name: str

    zone_values: dict[str, float] = Field(default_factory=dict)

    min_value: float | None = None
    max_value: float | None = None
    mean_value: float | None = None
    std_dev: float | None = None

    histogram: list[HistogramBin] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AnalyticsResult(KernelModel):
    """Container for non-feature analytical results (may stand alone)."""

    metrics: list[ScalarMetric] = Field(default_factory=list)
    tables: list[TabularData] = Field(default_factory=list)
    aggregations: list[SpatialAggregation] = Field(default_factory=list)

    # chart configs for the UI to render (open spec)
    chart_specs: list[dict[str, Any]] = Field(default_factory=list)

    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def is_empty(self) -> bool:
        return (
            len(self.metrics) == 0
            and len(self.tables) == 0
            and len(self.aggregations) == 0
        )

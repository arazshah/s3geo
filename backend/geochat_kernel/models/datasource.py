# geochat_kernel/models/datasource.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class SourceCapabilities(KernelModel):
    """
    Native operations a source can perform. OPEN via `extra` map so plugins
    can declare capabilities the kernel never hardcodes.
    """

    has_spatial_index: bool = False
    supports_fts: bool = False
    supports_zonal_stats: bool = False
    supports_spatial_joins: bool = False
    supports_temporal_queries: bool = False
    supports_sql: bool = False
    supports_remote_compute: bool = False  # e.g. GEE (Q15)

    # plugin-defined capability flags (open set)
    extra: dict[str, Any] = Field(default_factory=dict)


class DataSourceDescriptor(KernelModel):
    """
    Formal description of a data source available to the engine.

    `source_type` and `format` are OPEN strings (canonical values in
    vocabulary.KnownSourceType / KnownStorageFormat). Plugins may introduce
    new source types/formats without modifying the kernel.
    """

    id: str = Field(..., description="Unique source id (e.g. 'osm_urmia').")
    name: str
    source_type: str            # open string; canonical: KnownSourceType
    format: str                 # open string; canonical: KnownStorageFormat
    connection_uri: str | None = Field(default=None, repr=False)

    active_layers: list[str] = Field(default_factory=list)
    raster_bands: list[str] = Field(default_factory=list)

    capabilities: SourceCapabilities = Field(default_factory=SourceCapabilities)
    crs: str = "EPSG:4326"

    start_time: str | None = None
    end_time: str | None = None

    # how steps targeting this source should be executed (Q15)
    remote: bool = False
    metadata: dict[str, Any] = Field(default_factory=dict)

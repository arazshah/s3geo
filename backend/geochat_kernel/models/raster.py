# geochat_kernel/models/raster.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.geo_geometry import GeoBoundingBox


class RasterBand(KernelModel):
    """
    Lightweight band descriptor (Ref-level metadata only, Q3/Q18).

    No pixel access, no array data. Heavy raster IO/analysis lives in plugins.
    """

    name: str                       # e.g. "B4", "NDVI", "elevation"
    index: int | None = None
    dtype: str | None = None        # e.g. "float32" (advisory)
    nodata: float | None = None
    units: str | None = None
    description: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RasterStats(KernelModel):
    """
    Basic raster statistics (Q3: 'Ref + Basic Stats'). Carried by the kernel,
    computed by plugins. Per-band optional.
    """

    band: str | None = None
    min_value: float | None = None
    max_value: float | None = None
    mean_value: float | None = None
    std_dev: float | None = None
    valid_pixel_count: int | None = None
    nodata_pixel_count: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RasterRef(KernelModel):
    """
    A REFERENCE to a raster resource — never the pixels themselves (Q18).

    The kernel only forwards this reference between steps / to the response.
    Plugins resolve, read, transform, and analyze the actual raster.

    `uri` may be a local path, a COG URL, a GEE asset id, a tile template, etc.
    `crs` is carried, never transformed by the kernel (Q16).
    """

    id: str
    uri: str | None = None              # path / URL / asset id / tile template
    source_id: str | None = None        # DataSourceDescriptor.id
    format: str | None = None           # canonical: KnownStorageFormat (open)
    crs: str = "EPSG:4326"

    bbox: GeoBoundingBox | None = None
    bands: list[RasterBand] = Field(default_factory=list)
    resolution_m: float | None = None
    width: int | None = None
    height: int | None = None

    # temporal extent for time-series rasters
    start_time: str | None = None
    end_time: str | None = None

    # basic stats only (Q3)
    stats: list[RasterStats] = Field(default_factory=list)

    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def band_names(self) -> list[str]:
        return [b.name for b in self.bands]

# geochat_kernel/models/map_layer.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class MapStyle(KernelModel):
    """
    Minimal, renderer-agnostic styling contract (Q20).

    Intentionally small: the kernel only standardizes HOW a plugin returns a
    style, not a full cartographic spec. UIs (MapLibre/Leaflet/etc.) interpret.
    """

    color: str | None = None            # hex/css color
    fill_color: str | None = None
    opacity: float | None = Field(default=None, ge=0.0, le=1.0)
    weight: float | None = Field(default=None, ge=0.0)   # stroke width
    icon: str | None = None
    radius: float | None = Field(default=None, ge=0.0)
    # color ramp for raster/heatmap/choropleth layers
    color_ramp: list[str] = Field(default_factory=list)
    # arbitrary renderer-specific style props (open)
    extra: dict[str, Any] = Field(default_factory=dict)


class MapLayer(KernelModel):
    """
    A minimal map layer contract that plugins return for display (Q20).

    The kernel does not render. It only standardizes the envelope so the web
    app knows how to place a layer on the map. The actual data is referenced
    via inline GeoJSON, a RasterRef id, or a tile/source URL.
    """

    id: str
    layer_type: str                     # open: "geojson"|"raster"|"heatmap"|
    #                                     "tile"|"choropleth"|"contour"|...
    title: str | None = None
    visible: bool = True
    z_index: int = 0
    opacity: float | None = Field(default=None, ge=0.0, le=1.0)

    # one of the following carries the layer's data (all optional/open)
    geojson: dict[str, Any] | None = None     # inline FeatureCollection
    raster_ref_id: str | None = None          # points to a RasterRef in response
    source_url: str | None = None             # tile template / WMS / service url

    style: MapStyle = Field(default_factory=MapStyle)

    # optional legend definition for the UI
    legend: dict[str, Any] | None = None
    interactive: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)

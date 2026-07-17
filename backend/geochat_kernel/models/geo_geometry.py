# geochat_kernel/models/geo_geometry.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class GeoPoint(KernelModel):
    """
    A single geographic coordinate (WGS84), GeoJSON order (lon, lat).

    Pure transport: NO distance/projection math here (kernel is geometry-free).
    Such operations belong to plugins.
    """

    lon: float = Field(ge=-180.0, le=180.0)
    lat: float = Field(ge=-90.0, le=90.0)

    def as_geojson_coords(self) -> list[float]:
        """Serialization helper only (not computation): [lon, lat]."""
        return [self.lon, self.lat]


class GeoBoundingBox(KernelModel):
    """
    Geographic bounding box (WGS84). GeoJSON bbox order:
    [min_lon, min_lat, max_lon, max_lat].

    Pure transport: NO center/area/intersection math (kernel is geometry-free).
    """

    min_lon: float = Field(ge=-180.0, le=180.0)
    min_lat: float = Field(ge=-90.0, le=90.0)
    max_lon: float = Field(ge=-180.0, le=180.0)
    max_lat: float = Field(ge=-90.0, le=90.0)

    def as_geojson_bbox(self) -> list[float]:
        """Serialization helper only."""
        return [self.min_lon, self.min_lat, self.max_lon, self.max_lat]


class GeoGeometry(KernelModel):
    """
    Provider-agnostic, GeoJSON-compatible geometry container (transport only).

    `type`        : GeoJSON geometry type (Point, LineString, Polygon, Multi*,
                    GeometryCollection).
    `coordinates` : GeoJSON coordinate array (opaque to the kernel).
    `crs`         : carried, never validated/transformed by the kernel (Q16:
                    plugins validate/transform CRS as needed).
    `raw`         : lossless passthrough of original provider geometry.

    The kernel performs NO geometry operations. It only stores and forwards.
    """

    type: str
    coordinates: Any
    crs: str = "EPSG:4326"
    raw: dict[str, Any] | None = None

    def as_geojson(self) -> dict[str, Any]:
        """Serialization helper only."""
        return {"type": self.type, "coordinates": self.coordinates}

# geochat_kernel/models/geo_feature.py
from __future__ import annotations

from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.geo_geometry import (
    GeoBoundingBox,
    GeoGeometry,
    GeoPoint,
)


class StructuredAddress(KernelModel):
    """Provider-agnostic structured address. All fields optional."""

    full: str | None = None
    country: str | None = None
    country_code: str | None = None
    state: str | None = None
    province: str | None = None
    city: str | None = None
    district: str | None = None
    neighbourhood: str | None = None
    street: str | None = None
    house_number: str | None = None
    postcode: str | None = None
    floor: str | None = None
    unit: str | None = None


class SpatialMetrics(KernelModel):
    """
    Query-relative metrics ATTACHED by plugins (rankers, providers).

    The kernel never COMPUTES these (no distance/bearing math here). It only
    carries values that plugins have already computed.
    """

    distance_m: float | None = Field(default=None, ge=0.0)
    bearing_deg: float | None = Field(default=None, ge=0.0, lt=360.0)
    travel_time_s: float | None = Field(default=None, ge=0.0)
    rank: int | None = Field(default=None, ge=1)
    score: float | None = Field(default=None, ge=0.0, le=1.0)


class DisplayInfo(KernelModel):
    """
    Rendering hints, populated by semantic/display plugins (not providers,
    not the kernel). Kept on the feature pragmatically for transport.
    """

    icon: str | None = None
    color: str | None = None
    label: str | None = None
    category_label: str | None = None


class GeoFeature(KernelModel):
    """
    A single geographic feature (pure transport model).

    Design principles:
    - Provider-agnostic (`provider_tags` is raw, not OSM-specific).
    - GeoJSON-compatible geometry for direct map rendering.
    - Multi-lingual `names` for i18n.
    - `spatial_metrics` carried (computed by plugins, not the kernel).
    - `display` populated by display/semantic plugins.
    - NO computation methods (no nearest/center/distance) — kernel stays clean.
    """

    id: str = Field(default_factory=lambda: f"feat_{uuid4().hex}")

    # --- provider identity ---
    provider_id: str | None = None
    provider_name: str | None = None
    dataset_id: str | None = None

    # --- names (multi-lingual) ---
    name: str | None = None
    names: dict[str, str] = Field(default_factory=dict)

    # --- semantic classification ---
    semantic_type: str | None = None
    category: str | None = None
    subcategory: str | None = None

    # --- geometry (transport) ---
    geometry: GeoGeometry | None = None
    centroid: GeoPoint | None = None
    bbox: GeoBoundingBox | None = None

    # --- address ---
    address: StructuredAddress | None = None

    # --- contact / web ---
    phone: str | None = None
    website: str | None = None
    email: str | None = None
    opening_hours: str | None = None

    # --- raw provider data ---
    provider_tags: dict[str, Any] = Field(default_factory=dict)

    # --- query-relative metrics (set by plugins) ---
    spatial_metrics: SpatialMetrics = Field(default_factory=SpatialMetrics)

    # --- display hints (set by display/semantic plugins) ---
    display: DisplayInfo = Field(default_factory=DisplayInfo)

    # --- data quality ---
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    completeness: float = Field(default=1.0, ge=0.0, le=1.0)

    # --- extension ---
    metadata: dict[str, Any] = Field(default_factory=dict)

    # ------------------------------------------------------------------ #
    # Pure accessors / serialization helpers only.                         #
    # ------------------------------------------------------------------ #

    def get_name(self, lang: str = "fa", fallback: str = "unknown") -> str:
        """Language-specific lookup (no computation)."""
        return self.names.get(lang) or fallback

    @property
    def display_name(self) -> str:
        for lang in ("fa", "en"):
            if lang in self.names:
                return self.names[lang]
        if self.names:
            return next(iter(self.names.values()))
        return self.name or f"[{self.semantic_type or 'unknown'}]"

    @property
    def has_geometry(self) -> bool:
        return self.geometry is not None

    @property
    def has_location(self) -> bool:
        return self.centroid is not None or self.geometry is not None

    def as_geojson_feature(self) -> dict[str, Any]:
        """Serialization helper for direct map rendering (Leaflet/MapLibre)."""
        return {
            "type": "Feature",
            "id": self.id,
            "geometry": self.geometry.as_geojson() if self.geometry else None,
            "properties": {
                "id": self.id,
                "name": self.name,
                "names": self.names,
                "semantic_type": self.semantic_type,
                "category": self.category,
                "subcategory": self.subcategory,
                "distance_m": self.spatial_metrics.distance_m,
                "rank": self.spatial_metrics.rank,
                "score": self.spatial_metrics.score,
                "icon": self.display.icon,
                "color": self.display.color,
                "label": self.display.label,
                "phone": self.phone,
                "website": self.website,
                "opening_hours": self.opening_hours,
                "address": self.address.full if self.address else None,
                "provider_id": self.provider_id,
                "provider_name": self.provider_name,
            },
        }

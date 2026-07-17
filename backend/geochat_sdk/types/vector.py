# geochat_sdk/types/vector.py
from __future__ import annotations

import json
from typing import Any

from geochat_kernel.models.execution_artifact import ExecutionArtifact


class VectorIn:
    """
    Wrapper for input Vector/GeoJSON data.
    Provides lazy-loaded helper methods for GIS specialists.
    """

    def __init__(self, artifact: ExecutionArtifact) -> None:
        self.artifact = artifact

    @property
    def features(self) -> list[dict[str, Any]]:
        payload = self.artifact.payload or {}
        if "features" in payload:
            return payload["features"]
        return []

    def to_geopandas(self) -> Any:
        """Convert features to a GeoPandas GeoDataFrame."""
        try:
            import geopandas as gpd
        except ImportError as exc:
            from geochat_sdk.exceptions import SDKDependencyError
            raise SDKDependencyError(
                "geopandas is required to convert vector data to GeoDataFrame."
            ) from exc

        if not self.features:
            return gpd.GeoDataFrame()
        return gpd.GeoDataFrame.from_features(self.features)

    def to_shapely(self) -> list[Any]:
        """Convert features to Shapely geometries."""
        try:
            from shapely.geometry import shape
        except ImportError as exc:
            from geochat_sdk.exceptions import SDKDependencyError
            raise SDKDependencyError(
                "shapely is required to parse vector geometries."
            ) from exc

        geoms = []
        for f in self.features:
            if "geometry" in f:
                geoms.append(shape(f["geometry"]))
        return geoms


class VectorOut:
    """
    Wrapper for output Vector/GeoJSON data produced by a plugin.
    """

    def __init__(self, features: list[dict[str, Any]], metadata: dict[str, Any] | None = None) -> None:
        self.features = features
        self.metadata = metadata or {}

    @classmethod
    def from_geopandas(cls, gdf: Any) -> VectorOut:
        """Create VectorOut from a GeoDataFrame."""
        geojson_str = gdf.to_json()
        geojson = json.loads(geojson_str)
        return cls(features=geojson.get("features", []))

    def to_artifact(self, produced_by: str) -> ExecutionArtifact:
        return ExecutionArtifact.of_payload(
            kind="features",
            payload={"features": self.features, **self.metadata},
            produced_by=produced_by,
        )

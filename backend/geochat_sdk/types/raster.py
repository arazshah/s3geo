# geochat_sdk/types/raster.py
from __future__ import annotations

from pathlib import Path
from typing import Any

from geochat_kernel.models.execution_artifact import ExecutionArtifact


class RasterIn:
    """
    Wrapper for input Raster data.
    Provides lazy-loaded helper methods for RS specialists.
    """

    def __init__(self, artifact: ExecutionArtifact) -> None:
        self.artifact = artifact

    @property
    def path(self) -> str:
        payload = self.artifact.payload or {}
        return payload.get("path") or payload.get("url") or ""

    @property
    def metadata(self) -> dict[str, Any]:
        return self.artifact.payload or {}

    def read_numpy(self, band: int = 1) -> Any:
        """Read raster band as numpy array. Lazy imports numpy and rasterio."""
        try:
            import numpy as np
            import rasterio
        except ImportError as exc:
            from geochat_sdk.exceptions import SDKDependencyError
            raise SDKDependencyError(
                "numpy and rasterio are required to read raster data. "
                "Please install them in your plugin environment."
            ) from exc

        if not self.path or not Path(self.path).exists():
            raise FileNotFoundError(f"Raster file not found: {self.path}")

        with rasterio.open(self.path) as src:
            return src.read(band)

    def get_profile(self) -> dict[str, Any]:
        """Get raster profile metadata."""
        try:
            import rasterio
        except ImportError as exc:
            from geochat_sdk.exceptions import SDKDependencyError
            raise SDKDependencyError(
                "rasterio is required to read raster profile."
            ) from exc

        with rasterio.open(self.path) as src:
            return dict(src.profile)


class RasterOut:
    """
    Wrapper for output Raster data produced by a plugin.
    """

    def __init__(self, path: str, metadata: dict[str, Any] | None = None) -> None:
        self.path = path
        self.metadata = metadata or {}

    @classmethod
    def from_numpy(cls, data: Any, profile: dict[str, Any], output_path: str) -> RasterOut:
        """Write numpy array to a GeoTIFF file using rasterio."""
        try:
            import numpy as np
            import rasterio
        except ImportError as exc:
            from geochat_sdk.exceptions import SDKDependencyError
            raise SDKDependencyError(
                "numpy and rasterio are required to write raster data."
            ) from exc

        out_path = Path(output_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        # Update profile with single band and correct dtype
        profile.update(
            count=1 if len(data.shape) == 2 else data.shape[0],
            dtype=str(data.dtype),
        )

        with rasterio.open(str(out_path), "w", **profile) as dst:
            if len(data.shape) == 2:
                dst.write(data, 1)
            else:
                for i in range(data.shape[0]):
                    dst.write(data[i], i + 1)

        return cls(path=str(out_path), metadata={"profile": profile})

    def to_artifact(self, produced_by: str) -> ExecutionArtifact:
        return ExecutionArtifact.of_payload(
            kind="raster_ref",
            payload={"path": self.path, **self.metadata},
            produced_by=produced_by,
        )

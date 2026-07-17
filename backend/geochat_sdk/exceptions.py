# geochat_sdk/exceptions.py
from __future__ import annotations

class SDKError(Exception):
    """Base exception for all GeoChat SDK errors."""


class SDKDependencyError(SDKError):
    """Raised when a geospatial library (e.g., rasterio, geopandas) is required but missing."""


class SDKValidationError(SDKError):
    """Raised when a capability function signature, type, or mapping is invalid."""

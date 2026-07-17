"""
GeoChat SDK public API.

This __init__.py is aligned with the current SDK implementation:
- capability is defined in geochat_sdk.decorators
- auto_collect and SDKPlugin are defined in geochat_sdk.plugin
- Raster/Vector helper types are defined in geochat_sdk.types
"""

from __future__ import annotations

from geochat_sdk.decorators import capability
from geochat_sdk.plugin import auto_collect, SDKPlugin
from geochat_sdk.types.raster import RasterIn, RasterOut
from geochat_sdk.types.vector import VectorIn, VectorOut
from geochat_sdk.exceptions import SDKError, SDKDependencyError, SDKValidationError

__all__ = [
    "capability",
    "auto_collect",
    "SDKPlugin",
    "RasterIn",
    "RasterOut",
    "VectorIn",
    "VectorOut",
    "SDKError",
    "SDKDependencyError",
    "SDKValidationError",
]

__version__ = "1.0.0"

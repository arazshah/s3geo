# geochat_kernel/__init__.py
from __future__ import annotations

__version__ = "0.1.0"

from geochat_kernel.bootstrap import (
    PluginLoadFailure,
    PluginLoader,
    PluginLoadResult,
    load_plugins_from_folder,
)
from geochat_kernel.runtime import (
    ExecutionContext,
    KernelAppContainer,
    QueryPipeline,
    UserLocation,
)

__all__ = [
    "__version__",
    "PluginLoadFailure",
    "PluginLoader",
    "PluginLoadResult",
    "load_plugins_from_folder",
    "ExecutionContext",
    "KernelAppContainer",
    "QueryPipeline",
    "UserLocation",
]

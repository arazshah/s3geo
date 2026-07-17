# geochat_kernel/contracts/plugin.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.manifest import PluginManifest
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.models.vocabulary import Permission

if TYPE_CHECKING:
    from geochat_kernel.runtime.app_container import KernelAppContainer


class BasePlugin(ABC):
    """
    Base class for all trusted Python plugins.

    Design decisions:
    - Plugin is a capability package, not just a hook container.
    - A plugin can register multiple components.
    - register() is explicit and separate from initialize().
    - priority/dependencies/permissions live in PluginManifest.
    """

    @property
    @abstractmethod
    def manifest(self) -> PluginManifest:
        """Formal plugin manifest."""

    @property
    def id(self) -> str:
        return self.manifest.id

    @property
    def version(self) -> str:
        return self.manifest.version

    @property
    def priority(self) -> int:
        return self.manifest.priority

    def declares_permission(self, permission: Permission | str) -> bool:
        return self.manifest.declares_permission(permission)

    @abstractmethod
    async def register(self, container: "KernelAppContainer") -> None:
        """
        Register all plugin-provided components into kernel registries.

        Example:
        - container.planners.register_planner(...)
        - container.step_handlers.register_handler(...)
        - container.tools.register_tool(...)
        - container.semantic_types.register_type(...)
        """

    async def initialize(self, container: "KernelAppContainer") -> None:
        """Optional runtime initialization after all plugins are registered."""

    async def shutdown(self) -> None:
        """Optional graceful shutdown hook."""

    # ------------------------------------------------------------------ #
    # MVP hooks                                                           #
    # ------------------------------------------------------------------ #

    async def on_query_parsed(self, query_ir: QueryIR) -> QueryIR:
        return query_ir

    async def on_response_composed(self, response: GeoResponse) -> GeoResponse:
        return response

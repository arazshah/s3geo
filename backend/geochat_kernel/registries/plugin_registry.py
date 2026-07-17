# geochat_kernel/registries/plugin_registry.py
from __future__ import annotations

from geochat_kernel.contracts.plugin import BasePlugin
from geochat_kernel.errors import KernelDependencyError
from geochat_kernel.registries.ordered_registry import OrderedRegistry


class PluginRegistry(OrderedRegistry[BasePlugin]):
    """
    Registry for trusted Python plugins.

    Supports:
    - priority/order
    - dependencies
    - topological load order

    Dependency rule:
    A plugin's dependencies must be registered before resolving load order.
    """

    def __init__(self) -> None:
        super().__init__("plugin")

    def register_plugin(
        self,
        plugin: BasePlugin,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            plugin.id,
            plugin,
            priority=plugin.priority,
            replace=replace,
        )

    def resolve_load_order(self) -> list[BasePlugin]:
        """
        Return plugins in dependency-safe order.

        If multiple plugins are independent, priority is used as tie-breaker.
        """
        plugins = {name: plugin for name, plugin in self.ordered_items()}
        visiting: set[str] = set()
        visited: set[str] = set()
        result: list[BasePlugin] = []

        def visit(plugin_id: str, stack: list[str]) -> None:
            if plugin_id in visited:
                return

            if plugin_id in visiting:
                cycle = " -> ".join([*stack, plugin_id])
                raise KernelDependencyError(
                    f"Plugin dependency cycle detected: {cycle}",
                    details={"cycle": [*stack, plugin_id]},
                )

            plugin = plugins.get(plugin_id)
            if plugin is None:
                raise KernelDependencyError(
                    f"Plugin dependency not registered: {plugin_id}",
                    details={"missing_plugin_id": plugin_id},
                )

            visiting.add(plugin_id)

            # dependencies first, sorted by priority/name if available
            deps = list(plugin.manifest.dependencies)
            deps.sort(key=lambda dep: (self.get_priority(dep), dep))
            for dep in deps:
                if dep not in plugins:
                    raise KernelDependencyError(
                        f"Plugin '{plugin_id}' depends on missing plugin '{dep}'",
                        details={"plugin_id": plugin_id, "missing_dependency": dep},
                    )
                visit(dep, [*stack, plugin_id])

            visiting.remove(plugin_id)
            visited.add(plugin_id)
            result.append(plugin)

        for plugin_id, _ in self.ordered_items():
            visit(plugin_id, [])

        return result

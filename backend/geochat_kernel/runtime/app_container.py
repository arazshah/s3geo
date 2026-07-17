# geochat_kernel/runtime/app_container.py
from __future__ import annotations

from geochat_kernel.contracts.plugin import BasePlugin
from geochat_kernel.registries import (
    ArtifactBuilderRegistry,
    CacheRegistry,
    CapabilityRegistry,
    ComposerRegistry,
    FusionRegistry,
    LanguageRegistry,
    LLMRegistry,
    ParseStageRegistry,
    PlanOptimizerRegistry,
    PlannerRegistry,
    PluginRegistry,
    ProviderRegistry,
    QueryParserRegistry,
    RankerRegistry,
    RouterRegistry,
    SemanticEnricherRegistry,
    SemanticTypeRegistry,
    StepHandlerRegistry,
    ToolRegistry,
)
from geochat_kernel.runtime.routers import KeywordRouter
from geochat_kernel.runtime.stats_collector import StatisticsCollector


class KernelAppContainer:
    """
    Central dependency container for the kernel runtime.

    Plugins receive this container in register(container) and register their
    components into the appropriate registries.

    Router integration:
      - self.routers holds all routers.
      - KeywordRouter is registered by default, so the kernel always has a
        routing stage even without intelligence plugins.
      - self.stats_collector provides transparent historical_success signals.
    """

    def __init__(self) -> None:
        # plugin/capability
        self.plugins = PluginRegistry()
        self.capabilities = CapabilityRegistry()

        # parsing / semantic
        self.query_parsers = QueryParserRegistry()
        self.parse_stages = ParseStageRegistry()
        self.semantic_enrichers = SemanticEnricherRegistry()
        self.semantic_types = SemanticTypeRegistry()
        self.languages = LanguageRegistry()

        # routing
        self.routers = RouterRegistry()
        self.stats_collector = StatisticsCollector()

        # default free router — always available
        self.routers.register(KeywordRouter(), replace=True)

        # planning / execution
        self.planners = PlannerRegistry()
        self.plan_optimizers = PlanOptimizerRegistry()
        self.step_handlers = StepHandlerRegistry()

        # resources / tools
        self.providers = ProviderRegistry()
        self.tools = ToolRegistry()
        self.llms = LLMRegistry()
        self.caches = CacheRegistry()

        # response production
        self.fusions = FusionRegistry()
        self.rankers = RankerRegistry()
        self.artifact_builders = ArtifactBuilderRegistry()
        self.composers = ComposerRegistry()

        self._initialized = False

    def register_plugin(
        self,
        plugin: BasePlugin,
        *,
        replace: bool = False,
    ) -> None:
        """Register plugin manifest in PluginRegistry."""
        self.plugins.register_plugin(plugin, replace=replace)

    async def initialize_plugins(self) -> None:
        """
        Resolve plugin dependency order, register capabilities/components,
        then initialize plugins.
        """
        ordered_plugins = self.plugins.resolve_load_order()

        # 1) register declared capabilities first
        for plugin in ordered_plugins:
            self.capabilities.register_many(
                plugin.manifest.capabilities,
                plugin_id=plugin.id,
                replace=True,
            )

        # 2) allow plugins to register components
        for plugin in ordered_plugins:
            await plugin.register(self)

        # 3) initialize after all registries are populated
        for plugin in ordered_plugins:
            await plugin.initialize(self)

        self._initialized = True

    async def shutdown_plugins(self) -> None:
        """Shutdown plugins in reverse load order."""
        ordered_plugins = self.plugins.resolve_load_order()
        for plugin in reversed(ordered_plugins):
            await plugin.shutdown()

        self._initialized = False

    @property
    def initialized(self) -> bool:
        return self._initialized

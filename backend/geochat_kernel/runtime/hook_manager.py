# geochat_kernel/runtime/hook_manager.py
from __future__ import annotations

from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.models.vocabulary import HookPoint
from geochat_kernel.runtime.app_container import KernelAppContainer


class HookManager:
    """
    Hook executor.

    MVP active hooks:
    - ON_QUERY_PARSED
    - ON_RESPONSE_COMPOSED

    Other HookPoint values are already reserved in vocabulary for future use.
    """

    def __init__(self, container: KernelAppContainer) -> None:
        self.container = container

    async def on_query_parsed(self, query_ir: QueryIR) -> QueryIR:
        current = query_ir
        for plugin in self.container.plugins.resolve_load_order():
            current = await plugin.on_query_parsed(current)
        return current

    async def on_response_composed(self, response: GeoResponse) -> GeoResponse:
        current = response
        for plugin in self.container.plugins.resolve_load_order():
            current = await plugin.on_response_composed(current)
        return current

    def is_active(self, hook_point: HookPoint | str) -> bool:
        value = hook_point.value if isinstance(hook_point, HookPoint) else hook_point
        return value in {
            HookPoint.ON_QUERY_PARSED.value,
            HookPoint.ON_RESPONSE_COMPOSED.value,
        }

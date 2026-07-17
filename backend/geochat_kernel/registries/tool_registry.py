# geochat_kernel/registries/tool_registry.py
from __future__ import annotations

from geochat_kernel.contracts.tool import BaseTool
from geochat_kernel.registries.base_registry import BaseRegistry


class ToolRegistry(BaseRegistry[BaseTool]):
    """Registry for generic executable tools."""

    def __init__(self) -> None:
        super().__init__("tool")

    def register_tool(
        self,
        tool: BaseTool,
        *,
        replace: bool = False,
    ) -> None:
        self.register(tool.name, tool, replace=replace)

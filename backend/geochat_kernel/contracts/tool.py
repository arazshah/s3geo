# geochat_kernel/contracts/tool.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

from geochat_kernel.models.tool_result import ToolResult

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BaseTool(ABC):
    """
    Generic executable tool.

    Tools are not necessarily geodata providers. They can run classification,
    geocoding, routing, model inference, chart generation, remote calls, etc.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique tool name."""

    @property
    def description(self) -> str:
        return ""

    @property
    def parameters_schema(self) -> dict[str, Any]:
        """JSON schema-like parameter description."""
        return {}

    @abstractmethod
    async def execute(
        self,
        parameters: dict[str, Any],
        context: "ExecutionContext",
    ) -> ToolResult:
        """Execute the tool."""

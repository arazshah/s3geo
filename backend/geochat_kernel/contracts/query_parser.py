# geochat_kernel/contracts/query_parser.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.query_ir import QueryIR

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BaseQueryParser(ABC):
    """
    High-level parser contract.

    In vNext, the preferred architecture is multi-stage parsing via
    BaseParseStage. This contract remains useful for plugins that want to
    provide a complete parser as one component.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique parser name."""

    @property
    def version(self) -> str:
        return "unknown"

    def match_score(
        self,
        raw_text: str,
        context: "ExecutionContext",
    ) -> float:
        """0..1 suitability score. Default parser is generic."""
        return 0.5

    @abstractmethod
    async def parse(
        self,
        raw_text: str,
        context: "ExecutionContext",
    ) -> QueryIR:
        """Parse raw text into a QueryIR."""

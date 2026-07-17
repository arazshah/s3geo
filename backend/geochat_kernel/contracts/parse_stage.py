# geochat_kernel/contracts/parse_stage.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.query_ir import QueryIR

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BaseParseStage(ABC):
    """
    One stage in the multi-stage query understanding pipeline.

    Stages must be additive: they should preserve previous information and
    append InterpretationLayer entries instead of discarding earlier results.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique stage name."""

    @property
    def version(self) -> str:
        return "unknown"

    @property
    def priority(self) -> int:
        """Lower priority runs earlier."""
        return 100

    def can_handle(self, query_ir: QueryIR) -> bool:
        return True

    @abstractmethod
    async def apply(
        self,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> QueryIR:
        """Return an enriched QueryIR."""

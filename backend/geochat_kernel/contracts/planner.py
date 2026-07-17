# geochat_kernel/contracts/planner.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.models.query_plan import QueryPlan

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BasePlanner(ABC):
    """
    Builds a DAG QueryPlan from a QueryIR.

    Strategy has been intentionally removed. Planner + PlanExecutor +
    StepHandlers are the core execution architecture.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique planner name."""

    @property
    def priority(self) -> int:
        """Tie-breaker when scores are equal. Lower priority wins."""
        return 100

    @abstractmethod
    def match_score(
        self,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> float:
        """Return 0..1 suitability for this query."""

    @abstractmethod
    async def build_plan(
        self,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> QueryPlan:
        """Build a DAG QueryPlan."""

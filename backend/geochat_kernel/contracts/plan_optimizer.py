# geochat_kernel/contracts/plan_optimizer.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.models.query_plan import QueryPlan

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BasePlanOptimizer(ABC):
    """
    Optional optimizer for QueryPlan DAGs.

    Examples:
    - merge compatible fetch steps
    - reorder independent operations
    - add cache hints
    - rewrite remote/local execution choices
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique optimizer name."""

    @property
    def priority(self) -> int:
        return 100

    def can_optimize(self, plan: QueryPlan, query_ir: QueryIR) -> bool:
        return True

    @abstractmethod
    async def optimize(
        self,
        plan: QueryPlan,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> QueryPlan:
        """Return optimized QueryPlan."""

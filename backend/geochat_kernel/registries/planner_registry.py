# geochat_kernel/registries/planner_registry.py
from __future__ import annotations

from typing import TYPE_CHECKING

from geochat_kernel.contracts.planner import BasePlanner
from geochat_kernel.errors import KernelComponentNotFoundError
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.registries.ordered_registry import OrderedRegistry

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class PlannerRegistry(OrderedRegistry[BasePlanner]):
    """Registry selecting planners by match_score + priority."""

    def __init__(self) -> None:
        super().__init__("planner")

    def register_planner(
        self,
        planner: BasePlanner,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            planner.name,
            planner,
            priority=planner.priority,
            replace=replace,
        )

    def candidates(
        self,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> list[tuple[BasePlanner, float]]:
        scored: list[tuple[BasePlanner, float]] = []
        for name, planner in self.ordered_items():
            score = planner.match_score(query_ir, context)
            if score > 0:
                scored.append((planner, score))

        scored.sort(
            key=lambda pair: (
                -pair[1],
                self.get_priority(pair[0].name),
                pair[0].name,
            )
        )
        return scored

    def select_best(
        self,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> BasePlanner:
        scored = self.candidates(query_ir, context)
        if not scored:
            raise KernelComponentNotFoundError(
                "planner",
                "<best>",
                details={"query_ir_id": query_ir.id, "intent": query_ir.intent},
            )
        return scored[0][0]

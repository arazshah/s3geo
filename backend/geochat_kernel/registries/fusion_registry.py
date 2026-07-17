# geochat_kernel/registries/fusion_registry.py
from __future__ import annotations

from typing import TYPE_CHECKING

from geochat_kernel.contracts.result_fusion import BaseResultFusion
from geochat_kernel.models.execution_artifact import ExecutionArtifact
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.models.query_plan import QueryPlan
from geochat_kernel.registries.ordered_registry import OrderedRegistry

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class FusionRegistry(OrderedRegistry[BaseResultFusion]):
    """Registry for result fusion components."""

    def __init__(self) -> None:
        super().__init__("result_fusion")

    def register_fusion(
        self,
        fusion: BaseResultFusion,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            fusion.name,
            fusion,
            priority=fusion.priority,
            replace=replace,
        )

    def candidates(
        self,
        query_ir: QueryIR,
        plan: QueryPlan,
        artifacts: dict[str, ExecutionArtifact],
        context: "ExecutionContext",
    ) -> list[tuple[BaseResultFusion, float]]:
        scored: list[tuple[BaseResultFusion, float]] = []
        for _, fusion in self.ordered_items():
            score = fusion.match_score(query_ir, plan, artifacts, context)
            if score > 0:
                scored.append((fusion, score))

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
        plan: QueryPlan,
        artifacts: dict[str, ExecutionArtifact],
        context: "ExecutionContext",
    ) -> BaseResultFusion | None:
        scored = self.candidates(query_ir, plan, artifacts, context)
        return scored[0][0] if scored else None

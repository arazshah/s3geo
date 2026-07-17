# geochat_kernel/registries/plan_optimizer_registry.py
from __future__ import annotations

from geochat_kernel.contracts.plan_optimizer import BasePlanOptimizer
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.models.query_plan import QueryPlan
from geochat_kernel.registries.ordered_registry import OrderedRegistry


class PlanOptimizerRegistry(OrderedRegistry[BasePlanOptimizer]):
    """Ordered registry for optional DAG optimizers."""

    def __init__(self) -> None:
        super().__init__("plan_optimizer")

    def register_optimizer(
        self,
        optimizer: BasePlanOptimizer,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            optimizer.name,
            optimizer,
            priority=optimizer.priority,
            replace=replace,
        )

    def applicable(
        self,
        plan: QueryPlan,
        query_ir: QueryIR,
    ) -> list[BasePlanOptimizer]:
        return [
            optimizer
            for optimizer in self.ordered_values()
            if optimizer.can_optimize(plan, query_ir)
        ]

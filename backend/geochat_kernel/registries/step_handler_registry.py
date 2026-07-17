# geochat_kernel/registries/step_handler_registry.py
from __future__ import annotations

from geochat_kernel.contracts.step_handler import BaseStepHandler
from geochat_kernel.errors import KernelComponentNotFoundError
from geochat_kernel.models.query_plan import PlanStep
from geochat_kernel.registries.ordered_registry import OrderedRegistry


class StepHandlerRegistry(OrderedRegistry[BaseStepHandler]):
    """
    Registry for PlanStep handlers.

    Selects best handler by:
    1. match_score(step) descending
    2. priority ascending
    3. name ascending
    """

    def __init__(self) -> None:
        super().__init__("step_handler")

    def register_handler(
        self,
        handler: BaseStepHandler,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            handler.name,
            handler,
            priority=handler.priority,
            replace=replace,
        )

    def handlers_for_type(self, step_type: str) -> list[BaseStepHandler]:
        return [
            handler
            for handler in self.ordered_values()
            if step_type in handler.handled_types
        ]

    def candidates(self, step: PlanStep) -> list[tuple[BaseStepHandler, float]]:
        scored: list[tuple[BaseStepHandler, float]] = []
        for _, handler in self.ordered_items():
            score = handler.match_score(step)
            if score > 0:
                scored.append((handler, score))

        scored.sort(
            key=lambda pair: (
                -pair[1],
                self.get_priority(pair[0].name),
                pair[0].name,
            )
        )
        return scored

    def select_best(self, step: PlanStep) -> BaseStepHandler:
        scored = self.candidates(step)
        if not scored:
            raise KernelComponentNotFoundError(
                "step_handler",
                step.type,
                details={"step_id": step.id, "step_name": step.name},
            )
        return scored[0][0]

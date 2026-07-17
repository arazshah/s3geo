# geochat_kernel/contracts/step_handler.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.execution_artifact import ExecutionArtifact
from geochat_kernel.models.query_plan import PlanStep

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BaseStepHandler(ABC):
    """
    Executes one or more PlanStep types.

    A handler can wrap:
    - a data provider
    - a tool
    - a remote service
    - a GEE job
    - a model inference endpoint
    - any plugin-defined processor

    The kernel only routes steps to handlers. It performs no domain processing.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique handler name."""

    @property
    @abstractmethod
    def handled_types(self) -> list[str]:
        """Open step.type values this handler can execute."""

    @property
    def priority(self) -> int:
        """Lower priority wins when multiple handlers support same type."""
        return 100

    def can_handle(self, step: PlanStep) -> bool:
        return step.type in self.handled_types

    def match_score(self, step: PlanStep) -> float:
        """
        0..1 suitability score for this exact step.

        Registry/executor can use this to choose the best handler when multiple
        handlers declare the same step type.
        """
        return 1.0 if self.can_handle(step) else 0.0

    @abstractmethod
    async def handle(
        self,
        step: PlanStep,
        inputs: dict[str, ExecutionArtifact],
        context: "ExecutionContext",
    ) -> ExecutionArtifact:
        """Execute the step and return an ExecutionArtifact."""

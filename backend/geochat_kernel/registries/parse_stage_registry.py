# geochat_kernel/registries/parse_stage_registry.py
from __future__ import annotations

from geochat_kernel.contracts.parse_stage import BaseParseStage
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.registries.ordered_registry import OrderedRegistry


class ParseStageRegistry(OrderedRegistry[BaseParseStage]):
    """Ordered registry for multi-stage query parsing."""

    def __init__(self) -> None:
        super().__init__("parse_stage")

    def register_stage(
        self,
        stage: BaseParseStage,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            stage.name,
            stage,
            priority=stage.priority,
            replace=replace,
        )

    def applicable(self, query_ir: QueryIR) -> list[BaseParseStage]:
        return [
            stage
            for stage in self.ordered_values()
            if stage.can_handle(query_ir)
        ]

# geochat_kernel/registries/composer_registry.py
from __future__ import annotations

from typing import TYPE_CHECKING

from geochat_kernel.contracts.response_composer import BaseResponseComposer
from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.registries.ordered_registry import OrderedRegistry

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class ComposerRegistry(OrderedRegistry[BaseResponseComposer]):
    """Registry for response composers."""

    def __init__(self) -> None:
        super().__init__("response_composer")

    def register_composer(
        self,
        composer: BaseResponseComposer,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            composer.name,
            composer,
            priority=composer.priority,
            replace=replace,
        )

    def candidates(
        self,
        response: GeoResponse,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> list[tuple[BaseResponseComposer, float]]:
        scored: list[tuple[BaseResponseComposer, float]] = []
        for _, composer in self.ordered_items():
            score = composer.match_score(response, query_ir, context)
            if score > 0:
                scored.append((composer, score))

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
        response: GeoResponse,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> BaseResponseComposer | None:
        scored = self.candidates(response, query_ir, context)
        return scored[0][0] if scored else None

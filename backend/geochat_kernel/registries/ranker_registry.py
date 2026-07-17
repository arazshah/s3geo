# geochat_kernel/registries/ranker_registry.py
from __future__ import annotations

from typing import TYPE_CHECKING

from geochat_kernel.contracts.ranker import BaseRanker
from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.registries.ordered_registry import OrderedRegistry

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class RankerRegistry(OrderedRegistry[BaseRanker]):
    """Registry for response rankers."""

    def __init__(self) -> None:
        super().__init__("ranker")

    def register_ranker(
        self,
        ranker: BaseRanker,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            ranker.name,
            ranker,
            priority=ranker.priority,
            replace=replace,
        )

    def candidates(
        self,
        query_ir: QueryIR,
        response: GeoResponse,
        context: "ExecutionContext",
    ) -> list[tuple[BaseRanker, float]]:
        scored: list[tuple[BaseRanker, float]] = []
        for _, ranker in self.ordered_items():
            score = ranker.match_score(query_ir, response, context)
            if score > 0:
                scored.append((ranker, score))

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
        response: GeoResponse,
        context: "ExecutionContext",
    ) -> BaseRanker | None:
        scored = self.candidates(query_ir, response, context)
        return scored[0][0] if scored else None

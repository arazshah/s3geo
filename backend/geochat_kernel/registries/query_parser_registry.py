# geochat_kernel/registries/query_parser_registry.py
from __future__ import annotations

from typing import TYPE_CHECKING

from geochat_kernel.contracts.query_parser import BaseQueryParser
from geochat_kernel.errors import KernelComponentNotFoundError
from geochat_kernel.registries.ordered_registry import OrderedRegistry

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class QueryParserRegistry(OrderedRegistry[BaseQueryParser]):
    """Registry selecting high-level parsers by match_score + priority."""

    def __init__(self) -> None:
        super().__init__("query_parser")

    def register_parser(
        self,
        parser: BaseQueryParser,
        *,
        priority: int = 100,
        replace: bool = False,
    ) -> None:
        self.register(
            parser.name,
            parser,
            priority=priority,
            replace=replace,
        )

    def candidates(
        self,
        raw_text: str,
        context: "ExecutionContext",
    ) -> list[tuple[BaseQueryParser, float]]:
        scored: list[tuple[BaseQueryParser, float]] = []
        for _, parser in self.ordered_items():
            score = parser.match_score(raw_text, context)
            if score > 0:
                scored.append((parser, score))

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
        raw_text: str,
        context: "ExecutionContext",
    ) -> BaseQueryParser:
        scored = self.candidates(raw_text, context)
        if not scored:
            raise KernelComponentNotFoundError(
                "query_parser",
                "<best>",
                details={"raw_text": raw_text[:200]},
            )
        return scored[0][0]

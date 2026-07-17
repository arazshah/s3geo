# geochat_kernel/registries/semantic_enricher_registry.py
from __future__ import annotations

from geochat_kernel.contracts.semantic_enricher import BaseSemanticEnricher
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.registries.ordered_registry import OrderedRegistry


class SemanticEnricherRegistry(OrderedRegistry[BaseSemanticEnricher]):
    """Ordered registry for semantic enrichers."""

    def __init__(self) -> None:
        super().__init__("semantic_enricher")

    def register_enricher(
        self,
        enricher: BaseSemanticEnricher,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            enricher.name,
            enricher,
            priority=enricher.priority,
            replace=replace,
        )

    def applicable(self, query_ir: QueryIR) -> list[BaseSemanticEnricher]:
        return [
            enricher
            for enricher in self.ordered_values()
            if enricher.can_handle(query_ir)
        ]

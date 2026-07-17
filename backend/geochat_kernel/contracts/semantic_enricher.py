# geochat_kernel/contracts/semantic_enricher.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.query_ir import QueryIR

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BaseSemanticEnricher(ABC):
    """
    Enriches QueryIR semantically after parsing.

    Examples:
    - resolve synonyms to semantic types
    - attach display hints
    - normalize domain-specific concepts
    - add analysis-specific phenomenon metadata
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique enricher name."""

    @property
    def priority(self) -> int:
        return 100

    def can_handle(self, query_ir: QueryIR) -> bool:
        return True

    @abstractmethod
    async def enrich(
        self,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> QueryIR:
        """Return enriched QueryIR."""

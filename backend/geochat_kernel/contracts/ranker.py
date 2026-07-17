# geochat_kernel/contracts/ranker.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.query_ir import QueryIR

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BaseRanker(ABC):
    """
    Context-aware response ranker.

    Rankers should return a GeoResponse. They may mutate in-place or return a
    copy, but registries/runtime treat the returned value as authoritative.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique ranker name."""

    @property
    def priority(self) -> int:
        return 100

    def match_score(
        self,
        query_ir: QueryIR,
        response: GeoResponse,
        context: "ExecutionContext",
    ) -> float:
        return 0.5

    @abstractmethod
    async def rank(
        self,
        response: GeoResponse,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> GeoResponse:
        """Rank/sort/score response content."""

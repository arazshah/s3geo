# geochat_kernel/contracts/artifact_builder.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.query_ir import QueryIR

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BaseArtifactBuilder(ABC):
    """
    Adds/derives user-facing artifacts from a GeoResponse.

    Examples:
    - create a MapLayer from features
    - create a heatmap layer
    - create a chart artifact from analytics
    - attach a downloadable report artifact
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique artifact builder name."""

    @property
    def priority(self) -> int:
        return 100

    def can_build(self, response: GeoResponse, query_ir: QueryIR) -> bool:
        return True

    @abstractmethod
    async def build(
        self,
        response: GeoResponse,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> GeoResponse:
        """Return response enriched with artifacts/layers."""

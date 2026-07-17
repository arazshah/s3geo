# geochat_kernel/contracts/result_fusion.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.execution_artifact import ExecutionArtifact
from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.models.query_plan import QueryPlan

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BaseResultFusion(ABC):
    """
    Converts raw DAG ExecutionArtifacts into an initial GeoResponse.

    Fusion is where multiple step outputs are combined into response-level
    features, analytics, refs, layers, and artifacts.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique fusion component name."""

    @property
    def priority(self) -> int:
        return 100

    def match_score(
        self,
        query_ir: QueryIR,
        plan: QueryPlan,
        artifacts: dict[str, ExecutionArtifact],
        context: "ExecutionContext",
    ) -> float:
        return 0.5

    @abstractmethod
    async def fuse(
        self,
        query_ir: QueryIR,
        plan: QueryPlan,
        artifacts: dict[str, ExecutionArtifact],
        context: "ExecutionContext",
    ) -> GeoResponse:
        """Build initial GeoResponse from execution artifacts."""

# geochat_kernel/contracts/response_composer.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.query_ir import QueryIR

if TYPE_CHECKING:
    from geochat_kernel.runtime.execution_context import ExecutionContext


class BaseResponseComposer(ABC):
    """
    Produces/updates user-facing textual response fields.

    Plugins may provide specialized composers, e.g. flood risk explanation,
    fire response planning, site-selection reports, Persian conversation style.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique composer name."""

    @property
    def supported_languages(self) -> list[str]:
        return []

    @property
    def priority(self) -> int:
        return 100

    def match_score(
        self,
        response: GeoResponse,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> float:
        language = query_ir.language.strip().lower()
        if not self.supported_languages:
            return 0.5
        return 1.0 if language in [l.strip().lower() for l in self.supported_languages] else 0.0

    @abstractmethod
    async def compose(
        self,
        response: GeoResponse,
        query_ir: QueryIR,
        context: "ExecutionContext",
    ) -> GeoResponse:
        """Return response with user_message/report text composed."""

# geochat_kernel/contracts/semantic_registry.py
from __future__ import annotations

from abc import ABC, abstractmethod

from geochat_kernel.models.geo_feature import DisplayInfo


class BaseSemanticRegistry(ABC):
    """Abstract semantic type registry."""

    @abstractmethod
    def resolve_display(self, semantic_type: str) -> DisplayInfo:
        """Return display info for a semantic type."""

    @abstractmethod
    def get_canonical_type(self, label: str) -> str | None:
        """Resolve label/synonym to canonical semantic type."""

    @abstractmethod
    def list_types(self) -> list[str]:
        """List registered canonical semantic types."""

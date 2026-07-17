# geochat_kernel/registries/semantic_type_registry.py
from __future__ import annotations

from geochat_kernel.contracts.semantic_registry import BaseSemanticRegistry
from geochat_kernel.models.geo_feature import DisplayInfo


class SemanticTypeRegistry(BaseSemanticRegistry):
    """
    Minimal semantic type registry.

    Plugins can register semantic types and synonyms. The kernel does not
    enforce any ontology; it only provides lookup and display hints.
    """

    def __init__(self) -> None:
        self._display: dict[str, DisplayInfo] = {}
        self._synonyms: dict[str, str] = {}

    def register_type(
        self,
        semantic_type: str,
        *,
        display: DisplayInfo | None = None,
        synonyms: list[str] | None = None,
        replace: bool = False,
    ) -> None:
        if semantic_type in self._display and not replace:
            raise ValueError(f"Duplicate semantic type: {semantic_type}")

        self._display[semantic_type] = display or DisplayInfo()

        for s in synonyms or []:
            self._synonyms[self._normalize(s)] = semantic_type

        # self-alias
        self._synonyms[self._normalize(semantic_type)] = semantic_type

    def resolve_display(self, semantic_type: str) -> DisplayInfo:
        canonical = self.get_canonical_type(semantic_type) or semantic_type
        return self._display.get(canonical, DisplayInfo())

    def get_canonical_type(self, label: str) -> str | None:
        return self._synonyms.get(self._normalize(label))

    def list_types(self) -> list[str]:
        return sorted(self._display.keys())

    def has_type(self, semantic_type: str) -> bool:
        return semantic_type in self._display

    def clear(self) -> None:
        self._display.clear()
        self._synonyms.clear()

    @staticmethod
    def _normalize(value: str) -> str:
        return value.strip().lower()

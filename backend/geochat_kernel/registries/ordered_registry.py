# geochat_kernel/registries/ordered_registry.py
from __future__ import annotations

from typing import Generic, TypeVar

from geochat_kernel.registries.base_registry import BaseRegistry

T = TypeVar("T")


class OrderedRegistry(BaseRegistry[T], Generic[T]):
    """
    Registry with explicit priority support.

    Lower priority value means earlier execution / stronger precedence.
    """

    def __init__(self, component_type: str) -> None:
        super().__init__(component_type)
        self._priorities: dict[str, int] = {}

    def register(
        self,
        name: str,
        item: T,
        *,
        priority: int = 100,
        replace: bool = False,
    ) -> None:
        super().register(name, item, replace=replace)
        self._priorities[name] = priority

    def unregister(self, name: str) -> None:
        super().unregister(name)
        self._priorities.pop(name, None)

    def get_priority(self, name: str) -> int:
        return self._priorities.get(name, 100)

    def ordered_items(self) -> list[tuple[str, T]]:
        return sorted(
            self.items(),
            key=lambda pair: (self.get_priority(pair[0]), pair[0]),
        )

    def ordered_values(self) -> list[T]:
        return [item for _, item in self.ordered_items()]

    def ordered_names(self) -> list[str]:
        return [name for name, _ in self.ordered_items()]

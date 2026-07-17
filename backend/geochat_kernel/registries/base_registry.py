# geochat_kernel/registries/base_registry.py
from __future__ import annotations

from collections.abc import Iterable
from typing import Generic, TypeVar

from geochat_kernel.errors import (
    KernelComponentNotFoundError,
    KernelDuplicateComponentError,
)

T = TypeVar("T")


class BaseRegistry(Generic[T]):
    """
    Minimal named component registry.

    This is intentionally generic and dependency-free. Specialized registries
    add selection/scoring behavior on top.
    """

    def __init__(self, component_type: str) -> None:
        self.component_type = component_type
        self._items: dict[str, T] = {}

    def register(
        self,
        name: str,
        item: T,
        *,
        replace: bool = False,
    ) -> None:
        if name in self._items and not replace:
            raise KernelDuplicateComponentError(
                f"Duplicate {self.component_type}: {name}",
                details={"component_type": self.component_type, "name": name},
            )
        self._items[name] = item

    def unregister(self, name: str) -> None:
        self._items.pop(name, None)

    def get(self, name: str) -> T:
        try:
            return self._items[name]
        except KeyError as exc:
            raise KernelComponentNotFoundError(
                self.component_type,
                name,
                cause=exc,
            ) from exc

    def get_optional(self, name: str) -> T | None:
        return self._items.get(name)

    def has(self, name: str) -> bool:
        return name in self._items

    def names(self) -> list[str]:
        return list(self._items.keys())

    def values(self) -> list[T]:
        return list(self._items.values())

    def items(self) -> list[tuple[str, T]]:
        return list(self._items.items())

    def clear(self) -> None:
        self._items.clear()

    def __contains__(self, name: str) -> bool:
        return self.has(name)

    def __len__(self) -> int:
        return len(self._items)

    def __iter__(self) -> Iterable[T]:
        return iter(self._items.values())

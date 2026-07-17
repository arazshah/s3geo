# geochat_kernel/contracts/cache.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class BaseCache(ABC):
    """
    Cache abstraction only.

    The kernel defines the contract; implementations live outside the kernel:
    memory, Redis, file cache, database, object storage, etc.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique cache implementation name."""

    async def initialize(self) -> None:
        """Optional initialization."""

    async def shutdown(self) -> None:
        """Optional shutdown."""

    @abstractmethod
    async def get(self, key: str, *, namespace: str | None = None) -> Any | None:
        """Return cached value or None."""

    @abstractmethod
    async def set(
        self,
        key: str,
        value: Any,
        *,
        namespace: str | None = None,
        ttl_s: float | None = None,
    ) -> None:
        """Store value."""

    @abstractmethod
    async def delete(self, key: str, *, namespace: str | None = None) -> None:
        """Delete a cached value."""

    async def exists(self, key: str, *, namespace: str | None = None) -> bool:
        return await self.get(key, namespace=namespace) is not None

    async def clear_namespace(self, namespace: str) -> None:
        """
        Optional bulk clear. Implementations may override.

        Default is no-op because not all backends can efficiently support it.
        """

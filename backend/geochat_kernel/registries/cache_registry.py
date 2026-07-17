# geochat_kernel/registries/cache_registry.py
from __future__ import annotations

from geochat_kernel.contracts.cache import BaseCache
from geochat_kernel.registries.base_registry import BaseRegistry


class CacheRegistry(BaseRegistry[BaseCache]):
    """Registry for cache implementations."""

    def __init__(self) -> None:
        super().__init__("cache")
        self._default_name: str | None = None

    def register_cache(
        self,
        cache: BaseCache,
        *,
        default: bool = False,
        replace: bool = False,
    ) -> None:
        self.register(cache.name, cache, replace=replace)
        if default or self._default_name is None:
            self._default_name = cache.name

    def set_default(self, name: str) -> None:
        self.get(name)  # validate
        self._default_name = name

    def get_default(self) -> BaseCache | None:
        if self._default_name is None:
            return None
        return self.get(self._default_name)

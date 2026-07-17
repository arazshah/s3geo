# geochat_kernel/registries/llm_registry.py
from __future__ import annotations

from geochat_kernel.contracts.llm_provider import BaseLLMProvider
from geochat_kernel.registries.base_registry import BaseRegistry


class LLMRegistry(BaseRegistry[BaseLLMProvider]):
    """Registry for LLM providers."""

    def __init__(self) -> None:
        super().__init__("llm_provider")
        self._default_name: str | None = None

    def register_llm(
        self,
        provider: BaseLLMProvider,
        *,
        default: bool = False,
        replace: bool = False,
    ) -> None:
        self.register(provider.name, provider, replace=replace)
        if default or self._default_name is None:
            self._default_name = provider.name

    def set_default(self, name: str) -> None:
        self.get(name)  # validate exists
        self._default_name = name

    def get_default(self) -> BaseLLMProvider | None:
        if self._default_name is None:
            return None
        return self.get(self._default_name)

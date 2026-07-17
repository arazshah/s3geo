# geochat_kernel/contracts/llm_provider.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class BaseLLMProvider(ABC):
    """
    LLM provider abstraction.

    The kernel does not depend on any LLM vendor. Plugins provide concrete
    implementations. Pydantic structured output is acceptable because Pydantic
    is the only allowed kernel dependency.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique LLM provider name."""

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        *,
        system_prompt: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> str:
        """Generate plain text."""

    @abstractmethod
    async def generate_structured(
        self,
        prompt: str,
        response_model: type[T],
        *,
        system_prompt: str | None = None,
        options: dict[str, Any] | None = None,
    ) -> T:
        """Generate structured Pydantic output."""

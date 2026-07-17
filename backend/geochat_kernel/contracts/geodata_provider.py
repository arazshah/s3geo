# geochat_kernel/contracts/geodata_provider.py
from __future__ import annotations

from abc import ABC, abstractmethod

from geochat_kernel.models.datasource import DataSourceDescriptor


class BaseGeodataProvider(ABC):
    """
    Data provider abstraction.

    Providers expose data source metadata and optional lifecycle/health hooks.
    Actual step execution is handled by StepHandlers, which may internally use
    providers, tools, remote services, or anything else.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique provider name."""

    @abstractmethod
    def get_descriptor(self) -> DataSourceDescriptor:
        """Return source descriptor."""

    async def initialize(self) -> None:
        """Optional provider initialization."""

    async def shutdown(self) -> None:
        """Optional provider shutdown."""

    async def healthcheck(self) -> bool:
        """Optional healthcheck."""
        return True

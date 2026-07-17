# geochat_kernel/registries/provider_registry.py
from __future__ import annotations

from geochat_kernel.contracts.geodata_provider import BaseGeodataProvider
from geochat_kernel.models.datasource import DataSourceDescriptor
from geochat_kernel.registries.base_registry import BaseRegistry


class ProviderRegistry(BaseRegistry[BaseGeodataProvider]):
    """Registry for geodata providers."""

    def __init__(self) -> None:
        super().__init__("geodata_provider")

    def register_provider(
        self,
        provider: BaseGeodataProvider,
        *,
        replace: bool = False,
    ) -> None:
        self.register(provider.name, provider, replace=replace)

    def descriptors(self) -> list[DataSourceDescriptor]:
        return [provider.get_descriptor() for provider in self.values()]

    def find_by_source_type(self, source_type: str) -> list[BaseGeodataProvider]:
        return [
            provider
            for provider in self.values()
            if provider.get_descriptor().source_type == source_type
        ]

    def find_by_format(self, storage_format: str) -> list[BaseGeodataProvider]:
        return [
            provider
            for provider in self.values()
            if provider.get_descriptor().format == storage_format
        ]

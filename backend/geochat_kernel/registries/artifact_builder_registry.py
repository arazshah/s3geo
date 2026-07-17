# geochat_kernel/registries/artifact_builder_registry.py
from __future__ import annotations

from geochat_kernel.contracts.artifact_builder import BaseArtifactBuilder
from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.registries.ordered_registry import OrderedRegistry


class ArtifactBuilderRegistry(OrderedRegistry[BaseArtifactBuilder]):
    """Ordered registry for artifact builders."""

    def __init__(self) -> None:
        super().__init__("artifact_builder")

    def register_builder(
        self,
        builder: BaseArtifactBuilder,
        *,
        replace: bool = False,
    ) -> None:
        self.register(
            builder.name,
            builder,
            priority=builder.priority,
            replace=replace,
        )

    def applicable(
        self,
        response: GeoResponse,
        query_ir: QueryIR,
    ) -> list[BaseArtifactBuilder]:
        return [
            builder
            for builder in self.ordered_values()
            if builder.can_build(response, query_ir)
        ]

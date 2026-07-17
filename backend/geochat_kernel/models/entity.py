# geochat_kernel/models/entity.py
from __future__ import annotations

from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.vocabulary import EntityRole, GeometryHint


class Entity(KernelModel):
    """
    Language-neutral representation of an entity mentioned in a query.

    Design:
    - `role` and `geometry_hint` are OPEN strings (canonical values live in
      vocabulary). Plugins may use custom values without touching the kernel.
    - `semantic_type` is opaque; semantic plugins define/resolve its meaning.
    - `provider_tags` is generic (not OSM-specific) for provider independence.
    """

    id: str = Field(default_factory=lambda: f"ent_{uuid4().hex}")

    role: str = Field(default=EntityRole.UNKNOWN)
    raw_text: str | None = None
    name: str | None = None
    semantic_type: str | None = None

    provider_tags: list[dict[str, str]] = Field(default_factory=list)
    geometry_hint: str = Field(default=GeometryHint.UNKNOWN)
    resolved_feature_ids: list[str] = Field(default_factory=list)

    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def is_resolved(self) -> bool:
        return len(self.resolved_feature_ids) > 0

# geochat_kernel/models/spatial_relation.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.vocabulary import RelationKind


class SpatialRelation(KernelModel):
    """
    Language-neutral spatial relation between entities.

    - `kind` is OPEN (canonical values in vocabulary; plugins may extend).
    - Entities are referenced by id to keep this decoupled & serializable.
    """

    kind: str = Field(default=RelationKind.UNKNOWN)

    subject_id: str | None = None
    reference_id: str | None = None
    secondary_reference_id: str | None = None

    radius_m: float | None = Field(default=None, ge=0.0)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)

# geochat_kernel/models/query_ir.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.entity import Entity
from geochat_kernel.models.interpretation import InterpretationLayer, RawSegment
from geochat_kernel.models.spatial_relation import SpatialRelation
from geochat_kernel.models.vocabulary import QueryIntent


class BoundingBox(KernelModel):
    """Geographic bounding box constraint (WGS84, decimal degrees)."""

    min_lon: float
    min_lat: float
    max_lon: float
    max_lat: float


class TimeRange(KernelModel):
    """Optional temporal constraint (open-ended allowed)."""

    after: datetime | None = None
    before: datetime | None = None


class QueryConstraints(KernelModel):
    """All spatial/non-spatial constraints derived from the query."""

    radius_m: float | None = Field(default=None, ge=0.0)
    limit: int | None = Field(default=None, ge=1)
    min_rating: float | None = Field(default=None, ge=0.0, le=5.0)
    open_now: bool | None = None
    bbox: BoundingBox | None = None
    time_range: TimeRange | None = None

    # Open key/value filters; plugins define their own keys.
    filters: dict[str, Any] = Field(default_factory=dict)


class ParserInfo(KernelModel):
    """Provenance of the parser/NLU stack that produced this QueryIR."""

    name: str
    version: str = "unknown"
    language: str = "unknown"
    llm_assisted: bool = False
    duration_ms: float | None = None
    stages_applied: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AmbiguityInfo(KernelModel):
    """Ambiguity signals detected during parsing."""

    is_ambiguous: bool = False
    reasons: list[str] = Field(default_factory=list)
    candidates: list[dict[str, Any]] = Field(default_factory=list)
    clarification_hint: str | None = None


class QueryIR(KernelModel):
    """
    Intermediate Representation of a user query.

    Built incrementally by multiple parse stages (Q9/Q10). Single final
    interpretation is carried forward to planning (Q11), but the full
    interpretation history is preserved in `interpretation_layers` and
    `raw_segments` so nothing is ever discarded.
    """

    id: str = Field(default_factory=lambda: f"qir_{uuid4().hex}")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # --- raw input (never discarded) ---
    raw_text: str = ""
    language: str = "unknown"
    raw_segments: list[RawSegment] = Field(default_factory=list)

    # --- primary intent (single final interpretation, Q11) ---
    intent: str = Field(default=QueryIntent.UNKNOWN)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)

    # --- core content ---
    entities: list[Entity] = Field(default_factory=list)
    relations: list[SpatialRelation] = Field(default_factory=list)
    constraints: QueryConstraints = Field(default_factory=QueryConstraints)

    # --- multi-stage parsing history (Q9) ---
    interpretation_layers: list[InterpretationLayer] = Field(default_factory=list)

    # --- compound / analytical extensions ---
    sub_queries: list["QueryIR"] = Field(default_factory=list)
    source_restrictions: list[str] = Field(default_factory=list)
    execution_hints: dict[str, Any] = Field(default_factory=dict)

    # --- ambiguity & provenance ---
    ambiguity: AmbiguityInfo = Field(default_factory=AmbiguityInfo)
    parser_info: ParserInfo | None = None

    # --- pipeline context ---
    dataset_id: str | None = None
    session_id: str | None = None

    # --- notes (kernel-level processing trail) ---
    warnings: list[str] = Field(default_factory=list)
    report_steps: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    # ------------------------------------------------------------------ #
    # Pure accessors only (NO computation/geometry — kept in kernel).      #
    # ------------------------------------------------------------------ #

    def get_entities_by_role(self, role: str) -> list[Entity]:
        return [e for e in self.entities if e.role == role]

    def get_targets(self) -> list[Entity]:
        return self.get_entities_by_role("target")

    def get_anchors(self) -> list[Entity]:
        return self.get_entities_by_role("anchor")

    def get_entity_by_id(self, entity_id: str) -> Entity | None:
        for e in self.entities:
            if e.id == entity_id:
                return e
        return None

    def get_relations_by_kind(self, kind: str) -> list[SpatialRelation]:
        return [r for r in self.relations if r.kind == kind]

    def add_interpretation_layer(self, layer: InterpretationLayer) -> None:
        """Additive: append a parse-stage contribution (never overwrite)."""
        self.interpretation_layers.append(layer)

    @property
    def is_compound(self) -> bool:
        return len(self.sub_queries) > 0

    @property
    def is_ambiguous(self) -> bool:
        return self.ambiguity.is_ambiguous

    @property
    def has_radius(self) -> bool:
        return self.constraints.radius_m is not None

    @property
    def has_anchor(self) -> bool:
        return len(self.get_anchors()) > 0

    @property
    def has_target(self) -> bool:
        return len(self.get_targets()) > 0

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)

    def add_report_step(self, step: str) -> None:
        self.report_steps.append(step)


# resolve forward reference for self-nested sub_queries
QueryIR.model_rebuild()

# geochat_kernel/models/interpretation.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class RawSegment(KernelModel):
    """
    A preserved fragment of the original user query.

    Decision (Q9): nothing from the user query is ever discarded. Every parse
    stage maps the text into segments so later stages / audit can trace back
    exactly which words produced which interpretation.
    """

    text: str
    start: int | None = None          # char offset in raw_text (if known)
    end: int | None = None
    consumed_by: list[str] = Field(default_factory=list)  # stage names
    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def is_consumed(self) -> bool:
        return len(self.consumed_by) > 0


class InterpretationLayer(KernelModel):
    """
    Output contribution of a single parse/enrich stage.

    Layers are ADDITIVE: each stage appends a layer instead of mutating or
    deleting previous results. This preserves the full interpretation history
    of the query (Q9) and feeds the ExecutionTrace / AuditRecord.
    """

    stage_name: str
    stage_version: str = "unknown"
    produced_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # what this stage contributed (free-form, stage-defined)
    contribution: dict[str, Any] = Field(default_factory=dict)

    # references to entities/relations this stage added (by id)
    added_entity_ids: list[str] = Field(default_factory=list)
    added_relation_ids: list[str] = Field(default_factory=list)

    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    duration_ms: float | None = None
    notes: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

# geochat_kernel/models/audit.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class AuditRecord(KernelModel):
    """
    Audit payload for one request + response + trace (Q26).

    This is ONLY the model. Actual persistence (database, file, queue, object
    storage) belongs to an external implementation / plugin.

    To avoid circular imports and heavy objects, request/response/trace are
    stored as JSON-friendly dictionaries.
    """

    id: str = Field(default_factory=lambda: f"audit_{uuid4().hex}")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    request_id: str
    session_id: str | None = None
    user_id: str | None = None

    raw_text: str | None = None
    language: str | None = None
    dataset_id: str | None = None

    query_ir_id: str | None = None
    plan_id: str | None = None
    response_id: str | None = None
    trace_id: str | None = None

    status: str | None = None
    duration_ms: float | None = None

    # privacy/security bookkeeping
    permissions_used: list[str] = Field(default_factory=list)
    user_location_accessed: bool = False
    sensitive_data_accessed: bool = False

    # JSON-friendly snapshots
    request: dict[str, Any] = Field(default_factory=dict)
    query_ir: dict[str, Any] | None = None
    plan: dict[str, Any] | None = None
    response: dict[str, Any] | None = None
    trace: dict[str, Any] | None = None

    errors: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    metadata: dict[str, Any] = Field(default_factory=dict)

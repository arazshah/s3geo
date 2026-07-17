# geochat_kernel/models/trace.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.error_info import ErrorInfo


class TraceStatus:
    """
    Lightweight canonical trace statuses.

    Kept as strings instead of a closed enum to allow plugins/custom runtimes
    to introduce additional status values.
    """

    STARTED = "started"
    SUCCESS = "success"
    ERROR = "error"
    SKIPPED = "skipped"
    TIMEOUT = "timeout"
    PARTIAL = "partial"


class TraceEvent(KernelModel):
    """
    Fine-grained trace event.

    Useful for capturing decisions inside a stage without making every minor
    event a full TraceStep.
    """

    id: str = Field(default_factory=lambda: f"evt_{uuid4().hex}")
    name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    message: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TraceStep(KernelModel):
    """
    A formal trace record for one pipeline or DAG step (Q25).

    Examples:
    - parse.language_detection
    - parse.intent_classifier
    - planner.flood_risk_planner
    - execute.step_fetch_dem
    - execute.step_zonal_stats
    - fusion.default
    - compose.fa
    """

    id: str = Field(default_factory=lambda: f"trstep_{uuid4().hex}")

    # logical stage/point in the pipeline
    name: str
    phase: str | None = None            # parse | plan | execute | fusion | ...
    component: str | None = None        # plugin/component name if known

    status: str = TraceStatus.STARTED

    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None
    duration_ms: float | None = None

    # optional references
    query_ir_id: str | None = None
    plan_id: str | None = None
    plan_step_id: str | None = None
    artifact_ids: list[str] = Field(default_factory=list)

    # decision/provenance details
    inputs_summary: dict[str, Any] = Field(default_factory=dict)
    outputs_summary: dict[str, Any] = Field(default_factory=dict)
    decision: dict[str, Any] = Field(default_factory=dict)

    warnings: list[str] = Field(default_factory=list)
    error: ErrorInfo | None = None

    events: list[TraceEvent] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    def finish(
        self,
        *,
        status: str = TraceStatus.SUCCESS,
        error: ErrorInfo | None = None,
    ) -> None:
        self.status = status
        self.error = error
        self.ended_at = datetime.now(timezone.utc)
        delta = self.ended_at - self.started_at
        self.duration_ms = delta.total_seconds() * 1000

    def add_event(
        self,
        name: str,
        *,
        message: str | None = None,
        data: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.events.append(
            TraceEvent(
                name=name,
                message=message,
                data=dict(data or {}),
                metadata=dict(metadata or {}),
            )
        )

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)


class ExecutionTrace(KernelModel):
    """
    Full trace of one query execution (Q25).

    The runtime TraceRecorder will populate this. The model itself is just a
    serializable container suitable for API response, audit, and debugging.
    """

    id: str = Field(default_factory=lambda: f"trace_{uuid4().hex}")
    request_id: str | None = None
    session_id: str | None = None
    query_ir_id: str | None = None
    plan_id: str | None = None
    response_id: str | None = None

    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None
    duration_ms: float | None = None

    status: str = TraceStatus.STARTED

    steps: list[TraceStep] = Field(default_factory=list)
    events: list[TraceEvent] = Field(default_factory=list)

    warnings: list[str] = Field(default_factory=list)
    errors: list[ErrorInfo] = Field(default_factory=list)

    metadata: dict[str, Any] = Field(default_factory=dict)

    def start_step(
        self,
        name: str,
        *,
        phase: str | None = None,
        component: str | None = None,
        query_ir_id: str | None = None,
        plan_id: str | None = None,
        plan_step_id: str | None = None,
        inputs_summary: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> TraceStep:
        step = TraceStep(
            name=name,
            phase=phase,
            component=component,
            query_ir_id=query_ir_id,
            plan_id=plan_id,
            plan_step_id=plan_step_id,
            inputs_summary=dict(inputs_summary or {}),
            metadata=dict(metadata or {}),
        )
        self.steps.append(step)
        return step

    def add_event(
        self,
        name: str,
        *,
        message: str | None = None,
        data: dict[str, Any] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.events.append(
            TraceEvent(
                name=name,
                message=message,
                data=dict(data or {}),
                metadata=dict(metadata or {}),
            )
        )

    def add_error(self, error: ErrorInfo) -> None:
        self.errors.append(error)

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)

    def finish(self, *, status: str = TraceStatus.SUCCESS) -> None:
        self.status = status
        self.ended_at = datetime.now(timezone.utc)
        delta = self.ended_at - self.started_at
        self.duration_ms = delta.total_seconds() * 1000

# geochat_kernel/runtime/trace_recorder.py
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from geochat_kernel.models.error_info import ErrorInfo
from geochat_kernel.models.trace import TraceStatus, TraceStep
from geochat_kernel.runtime.execution_context import ExecutionContext


class TraceRecorder:
    """Convenience wrapper around ExecutionContext.trace."""

    def __init__(self, context: ExecutionContext) -> None:
        self.context = context

    @asynccontextmanager
    async def step(
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
    ) -> AsyncIterator[TraceStep]:
        trace_step = self.context.trace.start_step(
            name,
            phase=phase,
            component=component,
            query_ir_id=query_ir_id,
            plan_id=plan_id,
            plan_step_id=plan_step_id,
            inputs_summary=inputs_summary,
            metadata=metadata,
        )
        try:
            yield trace_step
        except Exception as exc:
            trace_step.finish(
                status=TraceStatus.ERROR,
                error=ErrorInfo(
                    code=type(exc).__name__,
                    message=str(exc),
                    recoverable=False,
                ),
            )
            raise
        else:
            trace_step.finish(status=TraceStatus.SUCCESS)

    def event(
        self,
        name: str,
        *,
        message: str | None = None,
        data: dict[str, Any] | None = None,
    ) -> None:
        self.context.trace.add_event(
            name,
            message=message,
            data=dict(data or {}),
        )

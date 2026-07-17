# geochat_kernel/runtime/execution_engine.py
from __future__ import annotations

import asyncio
import logging
from typing import Any

from geochat_kernel.contracts.step_handler import BaseStepHandler
from geochat_kernel.models.execution_artifact import ExecutionArtifact
from geochat_kernel.models.query_plan import PlanStep, QueryPlan
from geochat_kernel.runtime.execution_context import ExecutionContext
from geochat_kernel.runtime.execution_trace import ExecutionTrace, TraceEntry

logger = logging.getLogger(__name__)


class ExecutionEngine:
    """
    Executes QueryPlan steps with comprehensive error handling and tracing.
    """

    def __init__(self, handlers: dict[str, BaseStepHandler]):
        self._handlers = handlers

    async def execute(
        self,
        plan: QueryPlan,
        context: ExecutionContext,
    ) -> tuple[dict[str, ExecutionArtifact], ExecutionTrace]:
        """
        Executes plan steps and returns artifacts + trace.
        Exceptions are captured in trace, not re-raised.
        """
        trace = ExecutionTrace(query_ir_id=plan.query_ir_id, plan_id=plan.id)
        artifacts: dict[str, ExecutionArtifact] = {}

        for step in plan.steps:
            trace_entry = TraceEntry(step_name=step.name, step_type=step.type)

            try:
                logger.info(f"Executing step: {step.name} (type={step.type})")

                # ۱. پیدا کردن handler مناسب
                handler = self._find_handler(step.type)
                if not handler:
                    error_msg = f"No handler found for step type '{step.type}'"
                    logger.error(error_msg)
                    trace_entry.error = error_msg
                    trace_entry.status = "failed"
                    trace.entries.append(trace_entry)
                    continue

                # ۲. جمع‌آوری input artifacts
                step_inputs = {
                    ref: artifacts.get(ref)
                    for ref in step.dependencies
                    if ref in artifacts
                }

                # ۳. اجرای step با timeout
                try:
                    artifact = await asyncio.wait_for(
                        handler.handle(step, step_inputs, context),
                        timeout=30.0  # ۳۰ ثانیه timeout
                    )
                    artifacts[step.name] = artifact
                    trace_entry.status = "success"
                    trace_entry.output_key = step.name
                    logger.info(f"Step {step.name} completed successfully")

                except asyncio.TimeoutError:
                    error_msg = f"Step '{step.name}' timed out after 30 seconds"
                    logger.error(error_msg)
                    trace_entry.error = error_msg
                    trace_entry.status = "timeout"

                except Exception as e:
                    # ۴. CapturException تفصیلی
                    error_msg = f"Plan step failed: {step.name}"
                    error_detail = f"{type(e).__name__}: {str(e)}"
                    logger.error(f"{error_msg} - {error_detail}", exc_info=True)
                    trace_entry.error = error_msg
                    trace_entry.error_detail = error_detail
                    trace_entry.status = "failed"

            except Exception as e:
                # Exception خارج از try داخلی
                error_msg = f"Unexpected error in step {step.name}"
                error_detail = f"{type(e).__name__}: {str(e)}"
                logger.error(f"{error_msg} - {error_detail}", exc_info=True)
                trace_entry.error = error_msg
                trace_entry.error_detail = error_detail
                trace_entry.status = "failed"

            trace.entries.append(trace_entry)

        return artifacts, trace

    def _find_handler(self, step_type: str) -> BaseStepHandler | None:
        """
        پیدا کردن بهترین handler برای step_type.
        اگر exact match نبود، best-match را برمی‌گرداند.
        """
        # exact match
        for hid, handler in self._handlers.items():
            if step_type in handler.handled_types:
                return handler

        # pattern match (آخری وسیله)
        for hid, handler in self._handlers.items():
            for handled in handler.handled_types:
                if handled.startswith(step_type.rsplit(".", 1)[0] + "."):
                    return handler

        return None

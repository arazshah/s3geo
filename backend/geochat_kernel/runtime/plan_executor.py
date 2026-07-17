# geochat_kernel/runtime/plan_executor.py
from __future__ import annotations

import asyncio
import json
from typing import Any

from geochat_kernel.errors import KernelPlanExecutionError
from geochat_kernel.models.execution_artifact import ExecutionArtifact
from geochat_kernel.models.query_plan import PlanStep, QueryPlan
from geochat_kernel.models.trace import TraceStatus
from geochat_kernel.runtime.app_container import KernelAppContainer
from geochat_kernel.runtime.execution_context import ExecutionContext


class PlanExecutor:
    """
    Async DAG executor for QueryPlan.

    - Executes independent steps in parallel.
    - Routes each step to the best StepHandler.
    - Supports retries, timeout, cache abstraction.
    - Supports local live objects via ExecutionArtifact.
    - Remote serialization is left to remote-aware handlers.
    """

    def __init__(self, container: KernelAppContainer) -> None:
        self.container = container

    async def execute(
        self,
        plan: QueryPlan,
        context: ExecutionContext,
    ) -> dict[str, ExecutionArtifact]:
        problems = plan.validate_dag()
        if problems:
            raise KernelPlanExecutionError(
                "Invalid query plan DAG.",
                details={"plan_id": plan.id, "problems": problems},
            )

        completed: dict[str, ExecutionArtifact] = {}
        remaining: dict[str, PlanStep] = {step.id: step for step in plan.steps}

        while remaining:
            ready = [
                step
                for step in remaining.values()
                if all(dep in completed for dep in step.dependencies)
            ]

            if not ready:
                raise KernelPlanExecutionError(
                    "No executable steps remain. DAG may contain unresolved dependencies.",
                    details={
                        "plan_id": plan.id,
                        "remaining_step_ids": list(remaining.keys()),
                    },
                )

            if plan.parallel_execution_allowed:
                results = await asyncio.gather(
                    *[
                        self._execute_step(step, completed, plan, context)
                        for step in ready
                    ]
                )
            else:
                results = []
                for step in ready:
                    results.append(
                        await self._execute_step(step, completed, plan, context)
                    )

            for step, artifact in zip(ready, results, strict=True):
                completed[step.id] = artifact
                remaining.pop(step.id, None)

        return completed

    async def _execute_step(
        self,
        step: PlanStep,
        completed: dict[str, ExecutionArtifact],
        plan: QueryPlan,
        context: ExecutionContext,
    ) -> ExecutionArtifact:
        handler = self.container.step_handlers.select_best(step)
        inputs = self._resolve_inputs(step, completed)

        trace_step = context.trace.start_step(
            f"execute.{step.name}",
            phase="execute",
            component=handler.name,
            plan_id=plan.id,
            plan_step_id=step.id,
            inputs_summary={
                "step_type": step.type,
                "dependency_count": len(step.dependencies),
                "input_names": list(inputs.keys()),
                "remote": step.remote,
            },
        )

        cache = self.container.caches.get_default()
        cache_key = self._cache_key(plan, step)

        if cache is not None and step.cacheable and plan.cache_policy != "force_refresh":
            cached = await cache.get(cache_key, namespace="plan_step")
            if isinstance(cached, ExecutionArtifact):
                cached.metadata.setdefault("cache_hit", True)
                trace_step.outputs_summary = {
                    "artifact_id": cached.id,
                    "kind": cached.kind,
                    "cache_hit": True,
                }
                trace_step.finish(status=TraceStatus.SUCCESS)
                return cached

            if isinstance(cached, dict):
                artifact = ExecutionArtifact.from_dict(cached)
                artifact.metadata.setdefault("cache_hit", True)
                trace_step.outputs_summary = {
                    "artifact_id": artifact.id,
                    "kind": artifact.kind,
                    "cache_hit": True,
                }
                trace_step.finish(status=TraceStatus.SUCCESS)
                return artifact

        last_exc: Exception | None = None
        attempts = max(1, step.max_retries + 1)

        for attempt in range(1, attempts + 1):
            try:
                coro = handler.handle(step, inputs, context)
                if step.timeout_s is not None:
                    artifact = await asyncio.wait_for(coro, timeout=step.timeout_s)
                else:
                    artifact = await coro

                artifact.step_id = step.id
                artifact.produced_by = handler.name
                artifact.is_remote = step.remote

                if cache is not None and step.cacheable and plan.cache_policy != "skip":
                    # Store JSON-friendly form. If the artifact has a live object,
                    # it is automatically excluded by ExecutionArtifact.to_dict().
                    await cache.set(
                        cache_key,
                        artifact.to_dict(),
                        namespace="plan_step",
                    )

                trace_step.outputs_summary = {
                    "artifact_id": artifact.id,
                    "kind": artifact.kind,
                    "has_live": artifact.has_live,
                    "remote": artifact.is_remote,
                    "attempt": attempt,
                }
                trace_step.finish(status=TraceStatus.SUCCESS)
                return artifact

            except Exception as exc:
                last_exc = exc
                if attempt >= attempts:
                    trace_step.finish(status=TraceStatus.ERROR)
                    raise KernelPlanExecutionError(
                        f"Plan step failed: {step.name}",
                        details={
                            "plan_id": plan.id,
                            "step_id": step.id,
                            "step_type": step.type,
                            "handler": handler.name,
                            "attempts": attempts,
                            "error": str(exc),
                        },
                        cause=exc,
                    ) from exc

                await asyncio.sleep(0)

        raise KernelPlanExecutionError(
            f"Plan step failed: {step.name}",
            details={
                "plan_id": plan.id,
                "step_id": step.id,
                "error": str(last_exc) if last_exc else "unknown",
            },
        )

    @staticmethod
    def _resolve_inputs(
        step: PlanStep,
        completed: dict[str, ExecutionArtifact],
    ) -> dict[str, ExecutionArtifact]:
        inputs: dict[str, ExecutionArtifact] = {}

        if step.input_map:
            for logical_name, producing_step_id in step.input_map.items():
                if producing_step_id in completed:
                    inputs[logical_name] = completed[producing_step_id]
            return inputs

        # default: expose dependencies by their step ids
        for dep in step.dependencies:
            if dep in completed:
                inputs[dep] = completed[dep]

        return inputs

    @staticmethod
    def _cache_key(plan: QueryPlan, step: PlanStep) -> str:
        raw = {
            "plan_id": plan.id,
            "step": step.to_compact_dict(),
        }
        return json.dumps(raw, sort_keys=True, ensure_ascii=False, default=str)

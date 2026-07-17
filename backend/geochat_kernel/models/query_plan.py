# geochat_kernel/models/query_plan.py
from __future__ import annotations

from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class PlanStep(KernelModel):
    """
    A single atomic operation in a multi-source geospatial DAG.

    `type` is an OPEN string (canonical values in vocabulary.KnownStepType).
    Plugins may define new step types (e.g. 'flood_depth_estimation') and
    register a matching StepHandler — without touching the kernel.

    Input/output flow through ExecutionArtifact. `input_refs` maps a logical
    input name to a producing step id (DAG edges). The executor resolves these
    into actual ExecutionArtifacts before calling the handler.
    """

    id: str = Field(default_factory=lambda: f"step_{uuid4().hex}")
    type: str                                   # open; canonical: KnownStepType
    name: str

    # resources this step targets
    datasource_ids: list[str] = Field(default_factory=list)

    # DAG edges: steps that must finish before this one
    dependencies: list[str] = Field(default_factory=list)

    # logical input name -> producing step id (subset of dependencies)
    input_map: dict[str, str] = Field(default_factory=dict)

    # step-specific operation parameters
    parameters: dict[str, Any] = Field(default_factory=dict)

    # execution hints
    remote: bool = False                        # run on remote service (Q15)
    timeout_s: float | None = None
    max_retries: int = 0
    cacheable: bool = True

    cost_estimate: float | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class QueryPlan(KernelModel):
    """
    A Directed Acyclic Graph (DAG) of PlanSteps (Q12).

    Built by a Planner from a QueryIR, executed by the PlanExecutor. The kernel
    validates DAG integrity (no cycles, resolvable dependencies) but performs
    NO domain computation.
    """

    id: str = Field(default_factory=lambda: f"plan_{uuid4().hex}")
    query_ir_id: str

    steps: list[PlanStep] = Field(default_factory=list)

    estimated_duration_ms: float | None = None
    parallel_execution_allowed: bool = True
    cache_policy: str = "default"               # "skip" | "force_refresh" | "default"

    planner_name: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    # ------------------------------------------------------------------ #
    # Pure DAG helpers (structural only — no domain logic).                #
    # ------------------------------------------------------------------ #

    def get_step(self, step_id: str) -> PlanStep | None:
        for step in self.steps:
            if step.id == step_id:
                return step
        return None

    @property
    def step_ids(self) -> set[str]:
        return {step.id for step in self.steps}

    @property
    def leaf_steps(self) -> list[PlanStep]:
        """Steps no other step depends on (final outputs of the DAG)."""
        dependent = {dep for step in self.steps for dep in step.dependencies}
        return [step for step in self.steps if step.id not in dependent]

    @property
    def root_steps(self) -> list[PlanStep]:
        """Steps with no dependencies (entry points of the DAG)."""
        return [step for step in self.steps if not step.dependencies]

    def validate_dag(self) -> list[str]:
        """
        Structural validation. Returns a list of problems (empty == valid).
        Checks: dangling dependencies and cycles. No domain semantics.
        """
        problems: list[str] = []
        ids = self.step_ids

        for step in self.steps:
            for dep in step.dependencies:
                if dep not in ids:
                    problems.append(
                        f"Step '{step.id}' depends on unknown step '{dep}'."
                    )
            for logical, src in step.input_map.items():
                if src not in ids:
                    problems.append(
                        f"Step '{step.id}' input '{logical}' references "
                        f"unknown step '{src}'."
                    )

        if self._has_cycle():
            problems.append("Plan contains a dependency cycle.")

        return problems

    def _has_cycle(self) -> bool:
        graph = {step.id: list(step.dependencies) for step in self.steps}
        WHITE, GRAY, BLACK = 0, 1, 2
        color = dict.fromkeys(graph, WHITE)

        def visit(node: str) -> bool:
            color[node] = GRAY
            for nxt in graph.get(node, []):
                if nxt not in color:
                    continue
                if color[nxt] == GRAY:
                    return True
                if color[nxt] == WHITE and visit(nxt):
                    return True
            color[node] = BLACK
            return False

        return any(color[node] == WHITE and visit(node) for node in graph)

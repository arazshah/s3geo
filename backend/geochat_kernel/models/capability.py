# geochat_kernel/models/capability.py
from __future__ import annotations

from fnmatch import fnmatch
from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class CostHint(KernelModel):
    """
    Lightweight cost/latency hint for a capability.

    Used by routers and future CostGovernor integration.
    This is intentionally simple and JSON-friendly.
    """

    estimated_latency_ms: int | None = None
    uses_llm: bool = False
    uses_remote: bool = False
    relative_cost: float = Field(default=0.0, ge=0.0)
    estimated_usd: float | None = Field(default=None, ge=0.0)


class CapabilityDescriptor(KernelModel):
    """
    Describes what a plugin/component can do.

    All classification fields are OPEN strings/lists. Canonical values exist in
    vocabulary.ComponentKind, KnownStepType, QueryIntent, etc., but plugins may
    introduce their own capabilities without modifying the kernel.

    Router-facing fields feed the cascading router:
      cache -> keyword -> semantic -> LLM

    All new fields have safe defaults, so old descriptors remain compatible.
    """

    id: str = Field(default_factory=lambda: f"cap_{uuid4().hex}")

    name: str
    kind: str
    description: str | None = None

    # component identity within the plugin / registry
    plugin_id: str | None = None
    component_name: str | None = None

    # existing matching hints
    handles_intents: list[str] = Field(default_factory=list)
    handles_step_types: list[str] = Field(default_factory=list)
    handles_artifact_kinds: list[str] = Field(default_factory=list)
    handles_source_types: list[str] = Field(default_factory=list)
    supported_languages: list[str] = Field(default_factory=list)

    # ------------------------------------------------------------------ #
    # Router-facing metadata                                              #
    # ------------------------------------------------------------------ #

    # Layer 1: keyword router
    keywords: list[str] = Field(default_factory=list)
    intent_patterns: list[str] = Field(default_factory=list)

    # Layer 2/3: semantic and LLM routers
    semantic_description: str | None = None
    example_queries: list[str] = Field(default_factory=list)

    # input_availability hard filter + planning/composition hints
    required_inputs: list[str] = Field(default_factory=list)
    optional_inputs: list[str] = Field(default_factory=list)
    output_kind: str | None = None

    # LLM/cost/async hints
    requires_llm: bool = False
    long_running: bool = False
    cost: CostHint = Field(default_factory=CostHint)

    # Backward/simple numeric hint.
    # Kept for convenience; richer info should go into `cost`.
    estimated_cost: float = Field(default=0.0, ge=0.0)

    # operational hints
    requires_permissions: list[str] = Field(default_factory=list)
    priority: int = 100
    enabled: bool = True

    metadata: dict[str, Any] = Field(default_factory=dict)

    # ------------------------------------------------------------------ #
    # Router helpers                                                      #
    # ------------------------------------------------------------------ #

    def matches_language(self, language: str) -> bool:
        """
        Empty supported_languages means 'all languages'.
        """
        return (not self.supported_languages) or (language in self.supported_languages)

    def matches_intent(self, intent: str) -> bool:
        """
        Exact intent match OR glob-style pattern match.

        Examples:
            handles_intents = ["flood_risk"]
            intent_patterns = ["flood_*", "risk_*"]
        """
        if intent in self.handles_intents:
            return True
        return any(fnmatch(intent, pattern) for pattern in self.intent_patterns)

    def inputs_satisfied_by(self, available: set[str]) -> bool:
        """
        input_availability hard filter.

        If required_inputs is empty, the capability is always input-compatible.
        Otherwise all required_inputs must exist in available.
        """
        if not self.required_inputs:
            return True
        return set(self.required_inputs).issubset(available)

    def searchable_text(self) -> str:
        """
        Text blob useful for keyword/semantic/LLM router layers.
        """
        parts: list[str] = [
            self.name,
            self.kind,
            self.description or "",
            self.semantic_description or "",
            *self.keywords,
            *self.example_queries,
            *self.handles_intents,
            *self.intent_patterns,
        ]
        return " ".join(p for p in parts if p)

    @property
    def is_routable_for_router(self) -> bool:
        """
        True only for user-facing capabilities that the Router may select.

        Important:
        - Component descriptors such as query_parser/planner/step_handler/fusion
          may still be registered for discovery/documentation.
        - But Router must only see real user-facing capabilities.

        Default rule:
            enabled
            kind == "capability"
            metadata["routable"] is not False
        """
        if not self.enabled:
            return False

        if self.kind != "capability":
            return False

        return self.metadata.get("routable", True) is not False

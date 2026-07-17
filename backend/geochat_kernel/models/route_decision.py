# geochat_kernel/models/route_decision.py
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class RoutingStrategy(str, Enum):
    """Which cascade layer produced the decision (for trace/cost analysis)."""

    CACHE = "cache"          # layer 0 — semantic cache hit (zero cost)
    KEYWORD = "keyword"      # layer 1 — keyword/rule (free, in kernel)
    SEMANTIC = "semantic"    # layer 2 — embedding similarity (cheap, plugin)
    LLM = "llm"              # layer 3 — LLM selection (gated, plugin)
    BEST_GUESS = "best_guess"  # fallback when ambiguous + no LLM/budget
    CLARIFICATION = "clarification"  # ask the user instead of guessing


class RoutedCapability(KernelModel):
    """
    A single capability selected (or considered) by the router.

    Transport-safe by contract. The router references capabilities by their
    stable identifiers (name + plugin_id), NOT by embedding the full
    CapabilityDescriptor — this keeps RouteDecision decoupled and serializable.
    """

    capability_name: str
    plugin_id: str | None = None

    # final combined score and the raw signals that produced it (for trace)
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    signals: dict[str, float] = Field(default_factory=dict)
    # e.g. {"keyword": 0.9, "semantic": 0.8, "input_availability": 1.0,
    #       "historical_success": 0.95, "priority_bonus": 0.05}

    # composition: "primary" runs as the main capability,
    # "supporting" feeds into another (DAG composition)
    role: str = "primary"
    depends_on: list[str] = Field(default_factory=list)

    # opaque hints the planner may use (intent, suggested step type, params)
    hints: dict[str, Any] = Field(default_factory=dict)


class CostInfo(KernelModel):
    """Cost accounting for a routing decision (mostly LLM usage)."""

    llm_calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    estimated_usd: float = 0.0
    model: str | None = None

    def merged_with(self, other: "CostInfo") -> "CostInfo":
        return CostInfo(
            llm_calls=self.llm_calls + other.llm_calls,
            prompt_tokens=self.prompt_tokens + other.prompt_tokens,
            completion_tokens=self.completion_tokens + other.completion_tokens,
            estimated_usd=self.estimated_usd + other.estimated_usd,
            model=other.model or self.model,
        )


class RouteDecision(KernelModel):
    """
    The output of the routing stage (between Parse and Plan).

    This is the formal, traceable contract that answers:
      - which capabilities should run? (selected)
      - how confident are we? (confidence)
      - which cascade layer decided? (strategy_used)
      - what was rejected and why? (alternatives + reasoning)
      - do we need to ask the user? (needs_clarification)
      - what did it cost? (cost)

    The Planner consumes `selected` to build the QueryPlan (DAG). Everything
    here is JSON-friendly so it lands cleanly in ExecutionTrace / AuditRecord.
    """

    selected: list[RoutedCapability] = Field(default_factory=list)
    alternatives: list[RoutedCapability] = Field(default_factory=list)

    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    strategy_used: RoutingStrategy = RoutingStrategy.KEYWORD

    needs_clarification: bool = False
    clarification_question: str | None = None

    reasoning: list[str] = Field(default_factory=list)
    cost: CostInfo = Field(default_factory=CostInfo)
    metadata: dict[str, Any] = Field(default_factory=dict)

    # ------------------------------------------------------------------ #
    # Accessors                                                            #
    # ------------------------------------------------------------------ #

    @property
    def has_selection(self) -> bool:
        return len(self.selected) > 0

    @property
    def primary(self) -> RoutedCapability | None:
        for cap in self.selected:
            if cap.role == "primary":
                return cap
        return self.selected[0] if self.selected else None

    @property
    def primary_names(self) -> list[str]:
        return [c.capability_name for c in self.selected if c.role == "primary"]

    @property
    def is_multi_capability(self) -> bool:
        return len(self.selected) > 1

    # ------------------------------------------------------------------ #
    # Builders                                                             #
    # ------------------------------------------------------------------ #

    def add_reason(self, reason: str) -> "RouteDecision":
        self.reasoning.append(reason)
        return self

    def with_strategy(self, strategy: RoutingStrategy) -> "RouteDecision":
        self.strategy_used = strategy
        return self

    @classmethod
    def single(
        cls,
        capability_name: str,
        *,
        plugin_id: str | None = None,
        confidence: float,
        strategy: RoutingStrategy,
        signals: dict[str, float] | None = None,
        reasoning: list[str] | None = None,
    ) -> "RouteDecision":
        return cls(
            selected=[
                RoutedCapability(
                    capability_name=capability_name,
                    plugin_id=plugin_id,
                    score=confidence,
                    signals=dict(signals or {}),
                    role="primary",
                )
            ],
            confidence=confidence,
            strategy_used=strategy,
            reasoning=list(reasoning or []),
        )

    @classmethod
    def clarify(
        cls,
        question: str,
        *,
        alternatives: list[RoutedCapability] | None = None,
        confidence: float = 0.0,
        reasoning: list[str] | None = None,
    ) -> "RouteDecision":
        return cls(
            selected=[],
            alternatives=list(alternatives or []),
            confidence=confidence,
            strategy_used=RoutingStrategy.CLARIFICATION,
            needs_clarification=True,
            clarification_question=question,
            reasoning=list(reasoning or []),
        )

    @classmethod
    def empty(cls, reason: str = "no candidates matched") -> "RouteDecision":
        return cls(
            selected=[],
            confidence=0.0,
            strategy_used=RoutingStrategy.KEYWORD,
            reasoning=[reason],
        )

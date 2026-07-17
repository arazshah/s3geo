# geochat_kernel/contracts/router.py
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from geochat_kernel.models.capability import CapabilityDescriptor
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.models.route_decision import RouteDecision


@dataclass(frozen=True)
class RouterConfig:
    """
    Tunable thresholds for the cascading router (all decisions confirmed).

    HIGH    >= 0.85           -> accept without LLM
    MEDIUM  0.50 .. < 0.85    -> LLM optional (budget-dependent)
    LOW     < 0.50            -> LLM required
    competitive_gap < 0.10    -> call LLM even in HIGH zone (close race)

    Signal weights for multi-signal scoring also live here so the whole
    routing behavior is configurable without touching code.
    """

    high_threshold: float = 0.85
    medium_threshold: float = 0.50
    competitive_gap: float = 0.10

    # multi-signal weights (sum need not be 1.0; scores are normalized/clamped)
    weight_keyword: float = 0.30
    weight_semantic: float = 0.30
    weight_input_availability: float = 0.20
    weight_historical_success: float = 0.15
    weight_priority: float = 0.05

    # behavior toggles
    allow_clarification: bool = True
    max_selected: int = 5  # cap on capabilities returned (composition safety)

    def zone(self, confidence: float) -> str:
        """Return 'high' | 'medium' | 'low' for a confidence value."""
        if confidence >= self.high_threshold:
            return "high"
        if confidence >= self.medium_threshold:
            return "medium"
        return "low"


@dataclass
class RoutingRequest:
    """
    Everything a router needs to make a decision.

    `candidates` are the registered capabilities (already discovered). The
    router scores/selects among them; it never invents capability names.
    `available_inputs` powers the input_availability hard filter.
    """

    query_ir: QueryIR
    candidates: list[CapabilityDescriptor] = field(default_factory=list)
    available_inputs: set[str] = field(default_factory=set)
    language: str = "fa"
    # opaque context bag (user_location flags, budget remaining, etc.)
    context: dict = field(default_factory=dict)


class BaseRouter(ABC):
    """
    Contract for the routing stage (formal pipeline step between Parse and Plan).

    A router takes a parsed query + candidate capabilities and returns a
    RouteDecision: which capabilities run, with what confidence, via which
    cascade layer, and why.

    The kernel ships a default KEYWORD router (free, always available).
    SEMANTIC and LLM routers are PLUGINS that implement this same contract and
    register with higher relevance. The cascade orchestration itself may live
    in a composite router that delegates to these layers.

    `match_score` lets multiple routers coexist; the registry picks the most
    relevant one (mirroring the rest of the kernel).
    """

    name: str = "base_router"

    def match_score(self, request: RoutingRequest) -> float:
        """
        How suitable is this router for the given request? Default 0.5 so any
        concrete router is usable; specialized routers can raise/lower this.
        """
        return 0.5

    @abstractmethod
    async def route(
        self, request: RoutingRequest, config: RouterConfig
    ) -> RouteDecision:
        """Produce a RouteDecision for the request. MUST NOT raise on
        'no match'; return RouteDecision.empty(...) instead so the pipeline
        can degrade gracefully."""
        raise NotImplementedError

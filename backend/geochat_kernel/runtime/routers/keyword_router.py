# geochat_kernel/runtime/routers/keyword_router.py
from __future__ import annotations

from geochat_kernel.contracts.router import (
    BaseRouter,
    RouterConfig,
    RoutingRequest,
)
from geochat_kernel.models.capability import CapabilityDescriptor
from geochat_kernel.models.route_decision import (
    RouteDecision,
    RoutedCapability,
    RoutingStrategy,
)


class KeywordRouter(BaseRouter):
    """
    The default, always-available router (cascade layer 1).

    Free, fast, deterministic, dependency-free. Lives IN the kernel so the
    system always has a working router even with zero intelligence plugins.

    Scoring is multi-signal (weights from RouterConfig):
      - keyword       : fraction of capability keywords present in the query
      - intent        : QueryIR intent matches handles_intents / intent_patterns
      - input_avail   : HARD FILTER (required_inputs subset of available_inputs)
      - historical    : success_rate from stats (default 0.5 if unknown)
      - priority      : lower priority number -> small bonus

    Capabilities failing the hard input filter are DROPPED entirely.
    """

    name = "keyword_router"

    def match_score(self, request: RoutingRequest) -> float:
        # default router: usable but low relevance so smarter routers win
        return 0.4

    # ------------------------------------------------------------------ #

    async def route(
        self, request: RoutingRequest, config: RouterConfig
    ) -> RouteDecision:
        if not request.candidates:
            return RouteDecision.empty("no candidates registered")

        query_text = (request.query_ir.raw_text or "").lower()
        query_intent = self._extract_intent(request.query_ir)

        scored: list[RoutedCapability] = []
        dropped = 0

        for cap in request.candidates:
            if not cap.enabled:
                continue

            # --- hard filter: language ---
            if not cap.matches_language(request.language):
                dropped += 1
                continue

            # --- hard filter: required inputs ---
            if not cap.inputs_satisfied_by(request.available_inputs):
                dropped += 1
                continue

            signals = self._score_signals(
                cap, query_text, query_intent, request
            )
            final = self._combine(signals, config)

            scored.append(
                RoutedCapability(
                    capability_name=cap.name,
                    plugin_id=cap.plugin_id,
                    score=round(min(1.0, max(0.0, final)), 4),
                    signals={k: round(v, 4) for k, v in signals.items()},
                    role="primary",
                    hints={"intent": query_intent} if query_intent else {},
                )
            )

        if not scored:
            return RouteDecision.empty(
                f"all {len(request.candidates)} candidates filtered out "
                f"(language/inputs)"
            )

        scored.sort(key=lambda c: c.score, reverse=True)
        best = scored[0]
        rest = scored[1:]

        decision = RouteDecision(
            selected=[best],
            alternatives=rest[: config.max_selected],
            confidence=best.score,
            strategy_used=RoutingStrategy.KEYWORD,
        )
        decision.add_reason(
            f"keyword router: best='{best.capability_name}' "
            f"score={best.score} (candidates={len(request.candidates)}, "
            f"dropped={dropped})"
        )

        # competitive gap -> flag for potential LLM escalation upstream
        if rest:
            gap = best.score - rest[0].score
            if gap < config.competitive_gap:
                decision.metadata["competitive"] = True
                decision.metadata["runner_up"] = rest[0].capability_name
                decision.metadata["gap"] = round(gap, 4)
                decision.add_reason(
                    f"competitive: gap={gap:.4f} < {config.competitive_gap} "
                    f"(runner-up='{rest[0].capability_name}')"
                )

        return decision

    # ------------------------------------------------------------------ #
    # Scoring internals                                                    #
    # ------------------------------------------------------------------ #

    def _score_signals(
        self,
        cap: CapabilityDescriptor,
        query_text: str,
        query_intent: str | None,
        request: RoutingRequest,
    ) -> dict[str, float]:
        # keyword signal
        keywords = [k.lower() for k in (cap.keywords or [])]
        if keywords:
            hits = sum(1 for k in keywords if k in query_text)
            keyword_score = min(1.0, hits / max(1, len(keywords)) * 2.0)
            # *2.0: matching half the keywords already gives full signal
            keyword_score = min(1.0, keyword_score)
        else:
            keyword_score = 0.0

        # intent signal
        intent_score = 1.0 if (query_intent and cap.matches_intent(query_intent)) else 0.0

        # input availability (already passed hard filter -> 1.0; nuance optional)
        input_score = 1.0

        # historical success (from stats passed via context, default 0.5)
        stats: dict = request.context.get("stats", {})
        historical = float(stats.get(cap.name, 0.5))

        # priority bonus: lower number = better. map 0..200 -> 1..0
        priority_bonus = max(0.0, min(1.0, (200 - cap.priority) / 200.0))

        return {
            "keyword": keyword_score,
            "intent": intent_score,
            "input_availability": input_score,
            "historical_success": historical,
            "priority_bonus": priority_bonus,
            "language_ok": 1.0,
        }

    def _combine(self, signals: dict[str, float], config: RouterConfig) -> float:
        return (
            config.weight_keyword * signals["keyword"]
            + config.weight_semantic * signals["intent"]  # keyword router uses intent in semantic slot
            + config.weight_input_availability * signals["input_availability"]
            + config.weight_historical_success * signals["historical_success"]
            + config.weight_priority * signals["priority_bonus"]
        )

    @staticmethod
    def _extract_intent(query_ir) -> str | None:
        intent = getattr(query_ir, "intent", None)
        if intent is None:
            return None
        # intent may be an enum or a string
        return getattr(intent, "value", None) or str(intent)

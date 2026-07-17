# geochat_kernel/runtime/router/keyword_router.py
from __future__ import annotations

import re

from geochat_kernel.contracts.router import (
    BaseRouter,
    RouterConfig,
    RoutingRequest,
)
from geochat_kernel.models.capability import CapabilityDescriptor
from geochat_kernel.models.route_decision import (
    RoutedCapability,
    RouteDecision,
    RoutingStrategy,
)

_TOKEN_RE = re.compile(r"[^\w\u0600-\u06FF]+", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    """Unicode-aware tokenizer (handles Persian + Latin)."""
    text = (text or "").lower().strip()
    return [t for t in _TOKEN_RE.split(text) if t]


class KeywordRouter(BaseRouter):
    """
    Layer 1 of the cascade — the DEFAULT router shipped in the kernel.

    Free, fast, deterministic. Uses keyword/intent matching + the
    input_availability HARD filter + historical_success + priority. No external
    dependencies, no LLM, no embeddings.

    Scoring (weights from RouterConfig):
        keyword            : keyword/token overlap + intent match
        input_availability : HARD filter (0 => capability dropped entirely)
        historical_success : injected via request.context["stats"] (optional)
        priority           : lower descriptor.priority => small bonus
        semantic           : always 0 here (that's layer 2's job)

    Always returns a RouteDecision (never raises on no-match -> empty()).
    The cascade orchestrator decides whether to escalate to semantic/LLM.
    """

    name = "keyword_router"

    def match_score(self, request: RoutingRequest) -> float:
        # Always usable as the baseline; specialized routers outrank it.
        return 0.5

    async def route(
        self, request: RoutingRequest, config: RouterConfig
    ) -> RouteDecision:
        if not request.candidates:
            return RouteDecision.empty("no candidates registered")

        text = request.query_ir.raw_text or ""
        tokens = set(_tokenize(text))
        intent = self._extract_intent(request)
        stats: dict[str, float] = request.context.get("stats", {})  # name->success_rate

        scored: list[RoutedCapability] = []
        dropped: list[str] = []

        for cap in request.candidates:
            if not cap.enabled:
                continue

            # --- HARD filter: input availability -------------------------
            if not cap.inputs_satisfied_by(request.available_inputs):
                dropped.append(cap.name)
                continue

            # --- language filter (soft) ----------------------------------
            if cap.supported_languages and request.language not in cap.supported_languages:
                # not a hard drop, but penalize heavily
                lang_ok = 0.0
            else:
                lang_ok = 1.0

            kw_score = self._keyword_score(cap, tokens, text)
            intent_score = 1.0 if (intent and cap.matches_intent(intent)) else 0.0
            # keyword signal blends token overlap with intent match
            keyword_signal = max(kw_score, intent_score)

            hist = float(stats.get(cap.name, 0.5))  # neutral prior 0.5
            priority_bonus = self._priority_bonus(cap)

            final = (
                config.weight_keyword * keyword_signal
                + config.weight_input_availability * 1.0  # passed the hard filter
                + config.weight_historical_success * hist
                + config.weight_priority * priority_bonus
            ) * lang_ok

            final = max(0.0, min(1.0, final))

            scored.append(
                RoutedCapability(
                    capability_name=cap.name,
                    plugin_id=cap.plugin_id,
                    score=round(final, 4),
                    signals={
                        "keyword": round(keyword_signal, 4),
                        "intent": intent_score,
                        "input_availability": 1.0,
                        "historical_success": round(hist, 4),
                        "priority_bonus": round(priority_bonus, 4),
                        "language_ok": lang_ok,
                    },
                    role="primary",
                )
            )

        if not scored:
            d = RouteDecision.empty("all candidates failed input/language filter")
            if dropped:
                d.add_reason(f"dropped by input filter: {dropped}")
            return d

        scored.sort(key=lambda c: c.score, reverse=True)
        best = scored[0]
        rest = scored[1:]

        decision = RouteDecision(
            selected=[best],
            alternatives=rest[: max(0, config.max_selected - 1)],
            confidence=best.score,
            strategy_used=RoutingStrategy.KEYWORD,
        )
        decision.add_reason(
            f"keyword router: best='{best.capability_name}' score={best.score} "
            f"(candidates={len(scored)}, dropped={len(dropped)})"
        )

        # competitive-gap flag: let the cascade know it's a close race
        if rest:
            gap = best.score - rest[0].score
            if gap < config.competitive_gap:
                decision.metadata["competitive"] = True
                decision.metadata["competitive_gap"] = round(gap, 4)
                decision.add_reason(
                    f"close race (gap={round(gap, 4)} < {config.competitive_gap}); "
                    f"cascade may escalate to semantic/LLM"
                )

        # zone annotation (for the cascade orchestrator)
        decision.metadata["zone"] = config.zone(best.score)
        return decision

    # ------------------------------------------------------------------ #
    # Internals                                                            #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _keyword_score(
        cap: CapabilityDescriptor, query_tokens: set[str], raw_text: str
    ) -> float:
        """Overlap between capability keywords and the query."""
        keywords = [k.lower() for k in (cap.keywords or [])]
        if not keywords:
            return 0.0

        raw_lower = raw_text.lower()
        hits = 0
        for kw in keywords:
            # multi-word keyword -> substring match; single -> token match
            if " " in kw:
                if kw in raw_lower:
                    hits += 1
            elif kw in query_tokens or kw in raw_lower:
                hits += 1

        if hits == 0:
            return 0.0
        # diminishing returns: 1 hit=0.7, 2=0.9, 3+=1.0
        return min(1.0, 0.5 + 0.2 * hits + 0.1 * max(0, hits - 1))

    @staticmethod
    def _extract_intent(request: RoutingRequest) -> str | None:
        """Pull an intent string from QueryIR if present (best-effort)."""
        qir = request.query_ir
        for attr in ("intent", "primary_intent"):
            val = getattr(qir, attr, None)
            if val:
                return str(getattr(val, "value", val))
        return None

    @staticmethod
    def _priority_bonus(cap: CapabilityDescriptor) -> float:
        """
        Lower priority number => higher precedence => small score bonus.
        Maps priority 0..200 to bonus 1.0..0.0 (clamped).
        """
        p = cap.priority
        return max(0.0, min(1.0, 1.0 - (p / 200.0)))

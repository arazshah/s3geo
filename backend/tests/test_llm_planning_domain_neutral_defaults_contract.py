"""
LLM planning domain-neutral fallback contract.

Generic planning modules may keep compatibility APIs elsewhere, but LLM
fallbacks/prompts must not hard-code real-estate-specific private defaults.
"""

from __future__ import annotations

from pathlib import Path


LLM_SPEC_GENERATOR = Path("orchestrator/planning/llm_spec_generator.py")
LLM_QUERY_SPEC = Path("orchestrator/planning/llm_query_spec.py")
RISK_ENRICHMENT = Path("plugins/risk_enrichment.py")


def test_llm_spec_generator_uses_generic_ranked_feature_scoring_fallback() -> None:
    source = LLM_SPEC_GENERATOR.read_text(encoding="utf-8")

    assert "_default_ranked_feature_scoring_spec" in source
    assert "_default_real_estate_scoring_spec" not in source
    assert "Default MVP scoring spec for generic ranked-feature workflows" in source


def test_llm_score_features_repair_uses_generic_fallback() -> None:
    source = LLM_SPEC_GENERATOR.read_text(encoding="utf-8")

    assert 'op.op == "score_features"' in source
    assert 'clean_params["scoring_spec"] = _default_ranked_feature_scoring_spec()' in source
    assert 'clean_params["scoring_spec"] = _default_real_estate_scoring_spec()' not in source


def test_llm_query_spec_example_goal_is_domain_neutral() -> None:
    source = LLM_QUERY_SPEC.read_text(encoding="utf-8")

    assert '"goal": "rank_spatial_feature_options"' in source
    assert "rank_real_estate_investment_options" not in source


def test_risk_enrichment_keywords_do_not_use_real_estate_specific_phrase() -> None:
    source = RISK_ENRICHMENT.read_text(encoding="utf-8")

    assert '"site risk"' in source
    assert '"real estate risk"' not in source

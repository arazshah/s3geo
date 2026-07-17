"""
Real-estate boundary allowlist contract.

real_estate is currently supported as a domain plugin/compatibility use case,
but generic planning/output/plugin modules must not grow new hard-coded
real-estate dependencies.
"""

from __future__ import annotations

from pathlib import Path


ROOTS = [
    Path("smart_spatial_system/application"),
    Path("orchestrator"),
    Path("plugins"),
]


ALLOWED_REAL_ESTATE_REF_FILES = {
    # Domain plugin bridge.
    Path("plugins/real_estate_ranking_bridge.py"),

    # Plugin registration allowlist.
    Path("orchestrator/plugin_modules.py"),

    # Planning compatibility API.
    Path("orchestrator/planning/report_spec.py"),
    Path("orchestrator/planning/__init__.py"),

    # Application domain-specific modules.
    Path("smart_spatial_system/application/services/vector_display_handler.py"),
    Path("smart_spatial_system/application/services/query_execution/domain_direct_response_handlers.py"),
    Path("smart_spatial_system/application/services/query_execution/property_spatial_context_adapter.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_analysis_inspector.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_classifier.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_context.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_document_renderer.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_missing_inputs.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_ranking_artifacts.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_ranking_direct_handler.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_ranking_execution.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_ranking_response.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_report_payload.py"),
    Path("smart_spatial_system/application/services/query_execution/real_estate_scoring.py"),
    Path("smart_spatial_system/application/services/real_estate_spatial_helpers.py"),
}


FORBIDDEN_GENERIC_FILES = {
    Path("orchestrator/planning/llm_spec_generator.py"),
    Path("orchestrator/planning/llm_query_spec.py"),
    Path("plugins/report_builder.py"),
    Path("plugins/pdf_renderer.py"),
    Path("plugins/risk_enrichment.py"),
}


def _python_files() -> list[Path]:
    files: list[Path] = []

    for root in ROOTS:
        if not root.exists():
            continue
        files.extend(sorted(root.rglob("*.py")))

    return files


def test_real_estate_refs_are_limited_to_allowed_boundary_files() -> None:
    offenders: list[str] = []

    for path in _python_files():
        source = path.read_text(encoding="utf-8")
        lowered = source.lower()

        if "real_estate" not in lowered and "real estate" not in lowered:
            continue

        if path not in ALLOWED_REAL_ESTATE_REF_FILES:
            offenders.append(str(path))

    assert offenders == []


def test_generic_planning_and_output_modules_do_not_reintroduce_real_estate_refs() -> None:
    offenders: list[str] = []

    for path in sorted(FORBIDDEN_GENERIC_FILES):
        if not path.exists():
            continue

        source = path.read_text(encoding="utf-8").lower()
        if "real_estate" in source or "real estate" in source:
            offenders.append(str(path))

    assert offenders == []


def test_real_estate_report_spec_is_compatibility_api_only() -> None:
    report_spec = Path("orchestrator/planning/report_spec.py").read_text(encoding="utf-8")
    planning_init = Path("orchestrator/planning/__init__.py").read_text(encoding="utf-8")

    assert "def default_real_estate_report_spec(" in report_spec
    assert "default_ranked_features_report_spec" in report_spec
    assert "default_real_estate_report_spec" in planning_init


def test_generic_report_and_pdf_plugins_use_domain_neutral_defaults() -> None:
    report_builder = Path("plugins/report_builder.py").read_text(encoding="utf-8")
    pdf_renderer = Path("plugins/pdf_renderer.py").read_text(encoding="utf-8")

    assert "default_ranked_features_report_spec" in report_builder
    assert "default_real_estate_report_spec" not in report_builder

    assert 'DEFAULT_TEMPLATE = "default_report.html"' in pdf_renderer
    assert 'DEFAULT_TEMPLATE = "real_estate_report.html"' not in pdf_renderer

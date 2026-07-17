"""
PDF renderer generic default template contract.

pdf_renderer is a generic output plugin. Its default template must be
domain-neutral. Legacy domain-specific templates may remain available for
backwards compatibility when explicitly requested.
"""

from __future__ import annotations

from pathlib import Path

from plugins import pdf_renderer


def test_pdf_renderer_default_template_is_domain_neutral() -> None:
    assert pdf_renderer.DEFAULT_TEMPLATE == "default_report.html"
    assert "real_estate" not in pdf_renderer.DEFAULT_TEMPLATE


def test_pdf_renderer_default_template_file_exists() -> None:
    template_path = pdf_renderer.TEMPLATES_DIR / pdf_renderer.DEFAULT_TEMPLATE

    assert template_path.exists()
    assert template_path.is_file()


def test_pdf_renderer_keeps_legacy_real_estate_template_available_for_compatibility() -> None:
    legacy_template = pdf_renderer.TEMPLATES_DIR / "real_estate_report.html"

    assert legacy_template.exists()
    assert legacy_template.is_file()


def test_pdf_renderer_source_does_not_use_real_estate_template_as_default() -> None:
    source = Path("plugins/pdf_renderer.py").read_text(encoding="utf-8")

    assert 'DEFAULT_TEMPLATE = "default_report.html"' in source
    assert 'DEFAULT_TEMPLATE = "real_estate_report.html"' not in source

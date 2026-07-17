from __future__ import annotations

from pathlib import Path

import plugins.pdf_renderer as pdf_renderer


def _sample_report() -> dict:
    return {
        "meta": {
            "title": "گزارش تست",
            "request_id": "req-template-contract-001",
            "generated_at": "2026-01-01T00:00:00+00:00",
        },
        "summary": {
            "count": 2,
        },
        "table": {
            "title": "جدول",
            "columns": [
                {"name": "name", "label": "نام"},
                {"name": "score", "label": "امتیاز"},
            ],
            "rows": [
                {"name": "A", "score": 10},
                {"name": "B", "score": 8},
            ],
            "total_rows": 2,
        },
        "map_layers": [],
        "spec": {
            "title": "گزارش تست",
        },
        "success": True,
        "errors": [],
    }


def test_pdf_renderer_default_template_has_built_in_fallback(
    tmp_path: Path,
    monkeypatch,
) -> None:
    missing_templates_dir = tmp_path / "missing-templates"
    monkeypatch.setattr(pdf_renderer, "TEMPLATES_DIR", missing_templates_dir)

    monkeypatch.setattr(
        pdf_renderer,
        "_render_pdf_bytes",
        lambda html: b"%PDF-1.4\n% fallback template\n%%EOF\n",
    )

    output_path = tmp_path / "report.pdf"

    result = pdf_renderer.render_pdf(
        _sample_report(),
        output_path=str(output_path),
        save_to_disk=True,
    )

    assert result.success is True
    assert result.file_path == str(output_path)
    assert output_path.read_bytes().startswith(b"%PDF-1.4")
    assert "گزارش تست" in result.html
    assert result.meta["template"] == pdf_renderer.DEFAULT_TEMPLATE
    assert any(
        "used built-in default template" in item
        for item in result.errors
    )


def test_pdf_renderer_custom_template_still_requires_file(
    tmp_path: Path,
    monkeypatch,
) -> None:
    missing_templates_dir = tmp_path / "missing-templates"
    monkeypatch.setattr(pdf_renderer, "TEMPLATES_DIR", missing_templates_dir)

    result = pdf_renderer.render_pdf(
        _sample_report(),
        template_name="custom_report.html",
        save_to_disk=False,
    )

    assert result.success is False
    assert result.file_path is None
    assert result.html == ""
    assert result.errors
    assert "Template not found" in result.errors[0]

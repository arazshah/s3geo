"""
Generic report spec default contract tests.

Generic report-building plugins should depend on domain-neutral defaults.
The legacy real-estate default may remain as a compatibility API, but
plugins/report_builder.py should not import it as its generic default.
"""

from __future__ import annotations

from pathlib import Path

from orchestrator.planning.report_spec import (
    ReportSpec,
    default_ranked_features_report_spec,
)


def test_default_ranked_features_report_spec_builds_domain_neutral_report_spec() -> None:
    spec = default_ranked_features_report_spec(
        ranked_source="ranked_features",
        score_field="score",
        rank_field="rank",
        name_field="name",
    )

    assert isinstance(spec, ReportSpec)
    assert spec.map_layers
    assert spec.map_layers[0].source == "ranked_features"
    assert spec.map_layers[0].kind == "choropleth"
    assert spec.map_layers[0].style["color_field"] == "score"

    assert spec.tables
    assert spec.tables[0].source == "ranked_features"
    assert [column.field for column in spec.tables[0].columns] == [
        "rank",
        "name",
        "score",
    ]

    assert spec.summary is not None
    assert spec.summary.source == "ranked_features"


def test_report_builder_uses_generic_default_report_spec_not_real_estate_default() -> None:
    source = Path("plugins/report_builder.py").read_text(encoding="utf-8")

    assert "default_ranked_features_report_spec" in source
    assert "default_real_estate_report_spec" not in source

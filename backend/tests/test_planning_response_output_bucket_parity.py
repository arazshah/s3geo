from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from orchestrator.production_response import ProductionResponseBuilder
from smart_spatial_system.application.services.planning_response_adapter import (
    planning_outputs_to_response_payload,
)
from smart_spatial_system.application.services.query_execution.planning_response import (
    build_query_spec_planning_response,
)


def test_planning_outputs_mirror_artifacts_into_standard_buckets() -> None:
    report_payload = {
        "type": "report",
        "title": "تحلیل خروجی",
        "sections": [
            {
                "title": "خلاصه",
                "content": "ok",
            }
        ],
    }

    planning_result = SimpleNamespace(
        output_nodes={
            "report_node": report_payload,
            "raster_node": {
                "name": "NDVI",
                "raster_path": "/tmp/ndvi.tif",
            },
            "file_node": {
                "name": "جدول خروجی",
                "file_path": "/tmp/results.csv",
            },
            "table_node": [
                {"name": "A", "score": 91},
                {"name": "B", "score": 75},
            ],
        }
    )

    layers, outputs, primary_report = planning_outputs_to_response_payload(
        planning_result
    )

    assert layers == []
    assert primary_report == report_payload

    assert len(outputs["artifacts"]) == 4

    artifact_kinds_by_source = {
        artifact["source_node"]: artifact["kind"]
        for artifact in outputs["artifacts"]
    }

    assert artifact_kinds_by_source["report_node"] == "report"
    assert artifact_kinds_by_source["raster_node"] == "raster_ref"
    assert artifact_kinds_by_source["file_node"] == "download"
    assert artifact_kinds_by_source["table_node"] == "table"

    assert any(item.get("source_node") == "report_node" for item in outputs["reports"])
    assert any(item.get("source_node") == "raster_node" for item in outputs["rasters"])
    assert any(item.get("source_node") == "file_node" for item in outputs["files"])
    assert any(item.get("source_node") == "table_node" for item in outputs["tables"])


def test_query_spec_planning_response_exposes_frontend_output_fields() -> None:
    geojson = {
        "type": "FeatureCollection",
        "features": [],
    }
    report_payload = {
        "type": "report",
        "title": "گزارش",
        "sections": [],
    }

    planning_result = SimpleNamespace(
        success=True,
        error=None,
        structured_error=None,
        output_nodes={
            "layer_node": geojson,
            "report_node": report_payload,
            "file_node": {
                "file_path": "/tmp/report.pdf",
                "name": "PDF",
            },
        },
        trace=[],
        kernel_plan=None,
        kernel_execution=None,
    )

    response, metadata, success, error, structured_error = build_query_spec_planning_response(
        planning_result=planning_result,
        final_metadata={},
        final_request_id="req-1",
        query_spec=SimpleNamespace(),
        kernel_execution_enabled=False,
        planning_outputs_to_response_payload=planning_outputs_to_response_payload,
        planning_trace_to_steps=lambda trace: [],
        query_spec_to_dict_func=lambda query_spec: {},
        redact_sensitive_json=lambda value: value,
    )

    assert success is True
    assert error is None
    assert structured_error is None
    assert metadata["planning_summary"]["success"] is True

    assert response["ok"] is True
    assert response["request_id"] == "req-1"

    assert "outputs" in response
    assert "layers" in response
    assert "map" in response
    assert "files" in response
    assert "reports" in response
    assert "documents" in response
    assert "artifacts" in response

    assert response["map"]["layers"] == response["layers"]
    assert response["layers"][0]["id"] == "layer_node"
    assert any(item.get("source_node") == "file_node" for item in response["files"])
    assert any(item.get("source_node") == "report_node" for item in response["reports"])
    assert response["report"] == report_payload


def test_production_response_builder_exposes_files_reports_and_map_from_outputs() -> None:
    response = ProductionResponseBuilder().build_dict(
        run_result={
            "response": {
                "status": "success",
                "request_id": "req-1",
                "answer": "done",
            },
            "outputs": {
                "layers": [
                    {
                        "id": "layer-1",
                        "type": "vector",
                    }
                ],
                "files": [
                    {
                        "name": "result.csv",
                        "path": "/tmp/result.csv",
                    }
                ],
                "reports": [
                    {
                        "name": "summary",
                    }
                ],
                "artifacts": [
                    {
                        "id": "art-1",
                    }
                ],
            },
        }
    )

    assert response["ok"] is True
    assert response["layers"] == [{"id": "layer-1", "type": "vector"}]
    assert response["map"] == {"layers": [{"id": "layer-1", "type": "vector"}]}
    assert response["files"] == [{"name": "result.csv", "path": "/tmp/result.csv"}]
    assert response["reports"] == [{"name": "summary"}]
    assert response["artifacts"] == [{"id": "art-1"}]

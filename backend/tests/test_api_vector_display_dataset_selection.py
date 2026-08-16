"""Public selected-dataset contract tests for deterministic vector display."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))


from api.main import create_app  # noqa: E402
from orchestrator.service import (  # noqa: E402
    DEFAULT_SAFE_PLUGIN_MODULES,
    OrchestratorService,
    OrchestratorServiceConfig,
)


SAMPLE_VECTOR = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "A"},
            "geometry": {"type": "Point", "coordinates": [51.4, 35.7]},
        },
        {
            "type": "Feature",
            "properties": {"name": "B"},
            "geometry": {"type": "Point", "coordinates": [51.5, 35.8]},
        },
    ],
}


def _service(tmp_path: Path) -> OrchestratorService:
    return OrchestratorService(
        OrchestratorServiceConfig(
            plugin_modules=list(DEFAULT_SAFE_PLUGIN_MODULES),
            weights_path=tmp_path / "weights" / "router_weights.json",
            uploads_path=tmp_path / "uploads",
            outputs_path=tmp_path / "outputs",
            use_weighted_router=True,
            load_persisted_weights=True,
        )
    )


def _client(tmp_path: Path) -> tuple[TestClient, OrchestratorService]:
    service = _service(tmp_path)
    return TestClient(create_app(service=service)), service


def _upload_vector(client: TestClient) -> str:
    response = client.post(
        "/api/v1/uploads/vector",
        files={
            "file": (
                "display.geojson",
                json.dumps(SAMPLE_VECTOR).encode("utf-8"),
                "application/geo+json",
            )
        },
    )
    assert response.status_code == 200
    return response.json()["upload_id"]


def _assert_vector_display_response(payload: dict) -> None:
    assert payload["status"] == "succeeded"
    assert payload["metadata"]["execution_mode"] == "capability_bridge"
    assert payload["metadata"]["legacy_handler_name"] == "vector_display"
    assert payload["metadata"]["llm_planning_skipped"] == "deterministic_vector_display"
    assert [step["capability_name"] for step in payload["trace"]] == [
        "inspect_vector",
        "display_vector_layer",
    ]
    geojson = payload["map_layers"][0]["geojson"]
    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 2


def test_legacy_vector_ref_and_frontend_dataset_selection_are_equivalent(
    tmp_path: Path,
) -> None:
    client, _service = _client(tmp_path)
    upload_id = _upload_vector(client)

    legacy_response = client.post(
        "/api/v1/query",
        json={
            "query": "show vector features",
            "inputs": {"vector_ref": upload_id},
        },
    )
    selected_response = client.post(
        "/api/v1/query",
        json={
            "query": "show vector features",
            "datasets": [upload_id],
            "dataset_ids": [upload_id],
            "data_source_ids": [upload_id, upload_id],
        },
    )

    assert legacy_response.status_code == 200
    assert selected_response.status_code == 200
    legacy_payload = legacy_response.json()
    selected_payload = selected_response.json()
    _assert_vector_display_response(legacy_payload)
    _assert_vector_display_response(selected_payload)
    assert legacy_payload["map_layers"][0]["geojson"] == selected_payload["map_layers"][0]["geojson"]
    assert legacy_payload["metadata"]["query_request_normalization"]["binding_precedence"] == "explicit_vector_ref"
    assert selected_payload["metadata"]["query_request_normalization"] == {
        "request_shape": "selected_dataset_ids",
        "selected_dataset_ids": [upload_id],
        "normalized_dataset_selection": True,
        "bound_vector_ref": upload_id,
        "binding_precedence": "selected_dataset_id",
    }


def test_selected_vector_display_does_not_call_llm(tmp_path: Path, monkeypatch) -> None:
    client, service = _client(tmp_path)
    upload_id = _upload_vector(client)

    def fail_if_called(_query: str):
        raise AssertionError("LLM intent planning must not run for vector display")

    monkeypatch.setattr(service, "_maybe_plan_llm_intent", fail_if_called)

    response = client.post(
        "/api/v1/query",
        json={"query": "display vector layer", "data_source_ids": [upload_id]},
    )

    assert response.status_code == 200
    _assert_vector_display_response(response.json())


def test_explicit_vector_ref_precedes_selected_dataset_ids(tmp_path: Path) -> None:
    client, _service = _client(tmp_path)
    upload_id = _upload_vector(client)

    response = client.post(
        "/api/v1/query",
        json={
            "query": "show vector features",
            "inputs": {"vector_ref": upload_id},
            "data_source_ids": ["upl-stale-selection"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    _assert_vector_display_response(payload)
    assert payload["metadata"]["query_request_normalization"]["bound_vector_ref"] == upload_id


def test_vector_display_requires_one_known_selected_dataset(tmp_path: Path) -> None:
    client, _service = _client(tmp_path)
    upload_id = _upload_vector(client)

    missing_response = client.post(
        "/api/v1/query",
        json={"query": "show vector features"},
    )
    unknown_response = client.post(
        "/api/v1/query",
        json={"query": "show vector features", "data_source_ids": ["upl-missing"]},
    )
    ambiguous_response = client.post(
        "/api/v1/query",
        json={
            "query": "show vector features",
            "data_source_ids": [upload_id, "upl-other"],
        },
    )

    assert missing_response.status_code == 400
    assert missing_response.json()["detail"]["code"] == "input.dataset_selection_required"
    assert unknown_response.status_code == 400
    assert unknown_response.json()["detail"] == {
        "code": "input.dataset_not_found",
        "message": "The selected dataset was not found.",
        "details": {"dataset_id": "upl-missing"},
    }
    assert ambiguous_response.status_code == 400
    assert ambiguous_response.json()["detail"]["code"] == "input.dataset_selection_ambiguous"

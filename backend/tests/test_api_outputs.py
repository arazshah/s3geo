"""
Tests for output file API.

Run:
    pytest tests/test_api_outputs.py -v
"""

from __future__ import annotations

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


SATELLITE_RASTER_2BAND = {
    "data": [
        [
            [1, 1, 1],
            [1, 1, 1],
        ],
        [
            [2, 1, 4],
            [1, 3, 0.5],
        ],
    ],
    "metadata": {
        "transform": [10, 0, 100, 0, -10, 200],
        "crs": "EPSG:3857",
        "nodata": -9999,
    },
}


NDVI_QUERY = (
    "از تصویر ماهواره‌ای NDVI بگیر و مناطقی که NDVI آنها بیشتر از 0.3 است "
    "را به پلیگون تبدیل کن"
)


def _client(tmp_path: Path) -> TestClient:
    service = OrchestratorService(
        OrchestratorServiceConfig(
            plugin_modules=list(DEFAULT_SAFE_PLUGIN_MODULES),
            weights_path=tmp_path / "weights" / "router_weights.json",
            outputs_path=tmp_path / "outputs",
            persist_outputs=True,
            use_weighted_router=True,
            load_persisted_weights=True,
        )
    )

    app = create_app(service=service)

    return TestClient(app)


def _run_query(client: TestClient, request_id: str) -> None:
    response = client.post(
        "/query",
        json={
            "query": NDVI_QUERY,
            "inputs": {
                "raster": SATELLITE_RASTER_2BAND,
            },
            "band_map": {
                "red": 1,
                "nir": 2,
            },
            "request_id": request_id,
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "success"


def test_api_outputs_manifest_and_files(tmp_path: Path) -> None:
    client = _client(tmp_path)

    _run_query(
        client,
        "req-api-outputs-001",
    )

    manifest_response = client.get(
        "/requests/req-api-outputs-001/outputs"
    )

    assert manifest_response.status_code == 200

    manifest = manifest_response.json()

    assert manifest["request_id"] == "req-api-outputs-001"
    assert manifest["schema_version"] == "1.0.0"

    filenames = {
        item["filename"]
        for item in manifest["files"]
    }

    assert "manifest.json" in filenames
    assert "production_response.json" in filenames
    assert "audit_record.json" in filenames
    assert "outputs_summary.json" in filenames
    assert "map_layers.json" in filenames
    assert "vegetation_polygons.geojson" in filenames

    files_response = client.get(
        "/requests/req-api-outputs-001/outputs/files"
    )

    assert files_response.status_code == 200
    assert len(files_response.json()) >= 1


def test_api_download_geojson_file(tmp_path: Path) -> None:
    client = _client(tmp_path)

    _run_query(
        client,
        "req-api-outputs-geojson-001",
    )

    response = client.get(
        "/requests/req-api-outputs-geojson-001/outputs/files/vegetation_polygons.geojson"
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["type"] == "FeatureCollection"
    assert len(payload["features"]) == 3


def test_api_save_outputs_endpoint(tmp_path: Path) -> None:
    client = _client(tmp_path)

    _run_query(
        client,
        "req-api-outputs-save-001",
    )

    response = client.post(
        "/requests/req-api-outputs-save-001/outputs/save"
    )

    assert response.status_code == 200
    assert response.json()["request_id"] == "req-api-outputs-save-001"


def test_api_outputs_unknown_request_or_file_returns_404(tmp_path: Path) -> None:
    client = _client(tmp_path)

    response = client.get(
        "/requests/missing/outputs"
    )

    assert response.status_code == 404

    _run_query(
        client,
        "req-api-outputs-missing-file-001",
    )

    file_response = client.get(
        "/requests/req-api-outputs-missing-file-001/outputs/files/missing.geojson"
    )

    assert file_response.status_code == 404


def test_api_download_real_estate_report_document_file(
    tmp_path: Path,
    monkeypatch,
) -> None:
    monkeypatch.chdir(tmp_path)

    client = _client(tmp_path)

    request_id = "req-api-report-doc-001"
    filename = f"real_estate_ranking_{request_id}.pdf"

    reports_dir = tmp_path / "var" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    pdf_bytes = b"%PDF-1.4\n% test pdf\n%%EOF\n"
    (reports_dir / filename).write_bytes(pdf_bytes)

    response = client.get(
        f"/requests/{request_id}/documents/{filename}"
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert response.content == pdf_bytes


def test_api_download_real_estate_report_document_rejects_wrong_filename(
    tmp_path: Path,
    monkeypatch,
) -> None:
    monkeypatch.chdir(tmp_path)

    client = _client(tmp_path)

    response = client.get(
        "/requests/req-api-report-doc-002/documents/other.pdf"
    )

    assert response.status_code == 404


def test_api_outputs_manifest_exposes_normalized_output_contract(tmp_path: Path) -> None:
    client = _client(tmp_path)

    request_id = "req-api-output-contract-001"

    _run_query(
        client,
        request_id,
    )

    response = client.get(
        f"/requests/{request_id}/outputs"
    )

    assert response.status_code == 200

    manifest = response.json()

    assert manifest["request_id"] == request_id

    # Backward-compatible persisted file manifest remains available.
    assert isinstance(manifest["files"], list)
    assert any(item["filename"] == "manifest.json" for item in manifest["files"])
    assert any(item["filename"] == "output_contract.json" for item in manifest["files"])

    # Normalized frontend-facing output contract is available in the manifest.
    assert isinstance(manifest["outputs"], dict)
    assert isinstance(manifest["output_buckets"], dict)
    assert manifest["output_buckets"] == manifest["outputs"]

    for key in [
        "vectors",
        "rasters",
        "tables",
        "documents",
        "reports",
        "files",
        "artifacts",
    ]:
        assert key in manifest["outputs"]
        assert isinstance(manifest["outputs"][key], list)

    assert isinstance(manifest["layers"], list)
    assert isinstance(manifest["map"], dict)
    assert isinstance(manifest["map"]["layers"], list)
    assert isinstance(manifest["artifacts"], list)
    assert isinstance(manifest["reports"], list)
    assert isinstance(manifest["output_files"], list)


def _feature_collections_from_public_layers(layers):
    feature_collections = []

    if not isinstance(layers, list):
        return feature_collections

    for layer in layers:
        if not isinstance(layer, dict):
            continue

        for key in ("geojson", "data"):
            value = layer.get(key)

            if (
                isinstance(value, dict)
                and value.get("type") == "FeatureCollection"
                and isinstance(value.get("features"), list)
            ):
                feature_collections.append(value)

        payload = layer.get("payload")

        if isinstance(payload, dict):
            value = payload.get("data")

            if (
                isinstance(value, dict)
                and value.get("type") == "FeatureCollection"
                and isinstance(value.get("features"), list)
            ):
                feature_collections.append(value)

    return feature_collections


def test_api_map_layers_endpoint_matches_persisted_manifest_layers(tmp_path: Path) -> None:
    client = _client(tmp_path)

    request_id = "req-api-map-layer-parity-001"

    query_response = client.post(
        "/query",
        json={
            "query": NDVI_QUERY,
            "inputs": {
                "raster": SATELLITE_RASTER_2BAND,
            },
            "band_map": {
                "red": 1,
                "nir": 2,
            },
            "request_id": request_id,
        },
    )

    assert query_response.status_code == 200

    query_payload = query_response.json()

    assert query_payload["status"] == "success"

    manifest_response = client.get(
        f"/requests/{request_id}/outputs"
    )
    map_layers_response = client.get(
        f"/requests/{request_id}/map-layers"
    )

    assert manifest_response.status_code == 200
    assert map_layers_response.status_code == 200

    manifest = manifest_response.json()
    map_layers_payload = map_layers_response.json()

    assert manifest["request_id"] == request_id
    assert map_layers_payload["request_id"] == request_id

    # Persisted manifest and dedicated map-layer endpoint use the same builder.
    assert map_layers_payload["layers"] == manifest["layers"]
    assert manifest["map"]["layers"] == manifest["layers"]

    assert map_layers_payload["layer_count"] == len(map_layers_payload["layers"])
    assert map_layers_payload["layer_count"] == len(manifest["layers"])
    assert isinstance(map_layers_payload["warnings"], list)

    assert map_layers_payload["layers"]

    layer = map_layers_payload["layers"][0]

    assert layer["kind"] == "vector"

    # Map layers are frontend/Leaflet-ready in EPSG:4326, while source_crs
    # preserves the CRS of the original raster input.
    assert layer["crs"] == "EPSG:4326"
    assert layer["source_crs"] == "EPSG:3857"

    assert layer["geojson"]["type"] == "FeatureCollection"
    assert layer["feature_count"] == len(layer["geojson"]["features"])
    assert layer["feature_count"] == 3

    # The immediate /query response can use a slightly different public layer
    # shape, but it must expose the same map-compatible FeatureCollection.
    direct_layers = query_payload.get("layers", [])
    direct_map = query_payload.get("map", {})
    direct_map_layers = (
        direct_map.get("layers", [])
        if isinstance(direct_map, dict)
        else []
    )

    direct_feature_collections = (
        _feature_collections_from_public_layers(direct_layers)
        + _feature_collections_from_public_layers(direct_map_layers)
    )

    assert any(
        len(feature_collection["features"]) == layer["feature_count"]
        for feature_collection in direct_feature_collections
    )

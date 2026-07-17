"""
Frontend-facing API surface contract tests.

These tests lock lightweight API endpoints that the frontend depends on:
- root and health
- plugins list/detail/config read
- runtime settings
- weights
- OpenAPI route presence

Run:
    pytest tests/test_frontend_api_surface_contract.py -q
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))


from api.main import create_app  # noqa: E402
from orchestrator.service import (  # noqa: E402
    DEFAULT_SAFE_PLUGIN_MODULES,
    OrchestratorService,
    OrchestratorServiceConfig,
)


def _client(tmp_path: Path) -> TestClient:
    service = OrchestratorService(
        OrchestratorServiceConfig(
            plugin_modules=list(DEFAULT_SAFE_PLUGIN_MODULES),
            weights_path=tmp_path / "weights" / "router_weights.json",
            outputs_path=tmp_path / "outputs",
            uploads_path=tmp_path / "uploads",
            projects_path=tmp_path / "projects",
            persist_outputs=True,
            use_weighted_router=True,
            load_persisted_weights=True,
        )
    )

    app = create_app(service=service)

    return TestClient(app)


def _assert_no_secret_values(payload: Any) -> None:
    """
    Runtime settings may expose booleans such as api_key_configured,
    but must not expose raw secret values.
    """
    if isinstance(payload, dict):
        for key, value in payload.items():
            lowered = str(key).lower()

            assert lowered not in {
                "api_key",
                "apikey",
                "token",
                "access_token",
                "secret",
                "password",
            }

            _assert_no_secret_values(value)

    elif isinstance(payload, list):
        for item in payload:
            _assert_no_secret_values(item)


def test_frontend_root_health_runtime_and_weights_contract(tmp_path: Path) -> None:
    client = _client(tmp_path)

    root_response = client.get("/")

    assert root_response.status_code == 200

    root = root_response.json()

    assert root["status"] == "ok"
    assert root["service"] == "Smart Spatial System API"
    assert root["docs"] == "/docs"
    assert root["health"] == "/health"

    health_response = client.get("/health")

    assert health_response.status_code == 200

    health = health_response.json()

    assert health["status"] == "ok"
    assert health["service"] == "OrchestratorService"
    assert isinstance(health["plugin_modules"], list)
    assert health["plugin_modules"]
    assert isinstance(health["runtime_paths"], dict)
    assert "weights" in health

    runtime_response = client.get("/settings/runtime")

    assert runtime_response.status_code == 200

    runtime = runtime_response.json()

    assert set(runtime) >= {
        "llm",
        "plugins",
        "runtime",
        "runtime_paths",
    }

    assert isinstance(runtime["llm"]["api_key_configured"], bool)
    assert "api_key" not in runtime["llm"]
    assert "password" not in runtime["llm"]
    assert "secret" not in runtime["llm"]

    assert isinstance(runtime["plugins"]["module_names"], list)
    assert isinstance(runtime["plugins"]["plugin_ids"], list)
    assert isinstance(runtime["plugins"]["capabilities"], list)
    assert isinstance(runtime["plugins"]["capability_count"], int)
    assert runtime["plugins"]["capability_count"] >= 1

    _assert_no_secret_values(runtime)

    weights_response = client.get("/weights")

    assert weights_response.status_code == 200

    weights = weights_response.json()

    assert set(weights) >= {
        "config",
        "capability_weights",
        "plugin_weights",
    }
    assert isinstance(weights["capability_weights"], dict)
    assert isinstance(weights["plugin_weights"], dict)


def test_frontend_plugins_list_detail_and_config_contract(tmp_path: Path) -> None:
    client = _client(tmp_path)

    plugins_response = client.get("/plugins")

    assert plugins_response.status_code == 200

    plugins = plugins_response.json()

    assert isinstance(plugins, list)
    assert plugins

    first = plugins[0]

    assert set(first) >= {
        "plugin_id",
        "enabled",
        "config_path",
        "config_exists",
        "capability_count",
        "capabilities",
        "skipped",
        "skipped_error",
    }

    assert isinstance(first["plugin_id"], str)
    assert isinstance(first["enabled"], bool)
    assert isinstance(first["capability_count"], int)
    assert isinstance(first["capabilities"], list)

    plugin_id = first["plugin_id"]

    detail_response = client.get(f"/plugins/{plugin_id}")

    assert detail_response.status_code == 200

    detail = detail_response.json()

    assert detail["plugin_id"] == plugin_id
    assert detail["enabled"] == first["enabled"]
    assert detail["capability_count"] == first["capability_count"]

    configurable = next(
        (item for item in plugins if item.get("config_exists")),
        None,
    )

    assert configurable is not None

    config_plugin_id = configurable["plugin_id"]

    config_response = client.get(f"/plugins/{config_plugin_id}/config")

    assert config_response.status_code == 200

    config_payload = config_response.json()

    assert isinstance(config_payload, dict)
    assert config_payload


def test_frontend_openapi_contains_critical_routes(tmp_path: Path) -> None:
    client = _client(tmp_path)

    response = client.get("/openapi.json")

    assert response.status_code == 200

    openapi = response.json()
    paths = openapi["paths"]

    expected_paths = {
        "/",
        "/health",
        "/query",
        "/planner/intent",
        "/feedback",
        "/requests",
        "/requests/{request_id}",
        "/requests/{request_id}/map-layers",
        "/requests/{request_id}/outputs",
        "/requests/{request_id}/outputs/save",
        "/requests/{request_id}/outputs/files",
        "/requests/{request_id}/outputs/files/{filename}",
        "/requests/{request_id}/documents/{filename}",
        "/projects",
        "/projects/{project_id}",
        "/projects/{project_id}/data-sources",
        "/uploads/raster",
        "/uploads/vector",
        "/uploads",
        "/uploads/{upload_id}",
        "/uploads/{upload_id}/file",
        "/data-sources/{upload_id}",
        "/data-sources/{upload_id}/preview",
        "/data-sources/csv-table",
        "/data-sources/wms",
        "/data-sources/postgis",
        "/data-sources/wfs",
        "/data-sources/url",
        "/plugins",
        "/plugins/{plugin_id}",
        "/plugins/{plugin_id}/config",
        "/settings/runtime",
        "/settings/llm/smoke-test",
        "/weights",
        "/weights/save",
        "/weights/reload",
        "/weights/proposals/apply",
    }

    expected_v1_paths = {
        "/api/v1/query",
        "/api/v1/planner/intent",
        "/api/v1/feedback",
        "/api/v1/requests",
        "/api/v1/requests/{request_id}",
        "/api/v1/requests/{request_id}/map-layers",
        "/api/v1/requests/{request_id}/outputs",
        "/api/v1/requests/{request_id}/outputs/save",
        "/api/v1/requests/{request_id}/outputs/files",
        "/api/v1/requests/{request_id}/outputs/files/{filename}",
        "/api/v1/requests/{request_id}/documents/{filename}",
        "/api/v1/projects",
        "/api/v1/projects/{project_id}",
        "/api/v1/projects/{project_id}/data-sources",
        "/api/v1/uploads/raster",
        "/api/v1/uploads/vector",
        "/api/v1/uploads",
        "/api/v1/uploads/{upload_id}",
        "/api/v1/uploads/{upload_id}/file",
        "/api/v1/data-sources/{upload_id}",
        "/api/v1/data-sources/{upload_id}/preview",
        "/api/v1/data-sources/csv-table",
        "/api/v1/data-sources/wms",
        "/api/v1/data-sources/postgis",
        "/api/v1/data-sources/wfs",
        "/api/v1/data-sources/url",
        "/api/v1/plugins",
        "/api/v1/plugins/{plugin_id}",
        "/api/v1/plugins/{plugin_id}/config",
        "/api/v1/settings/runtime",
        "/api/v1/settings/llm/smoke-test",
        "/api/v1/weights",
        "/api/v1/weights/save",
        "/api/v1/weights/reload",
        "/api/v1/weights/proposals/apply",
    }

    missing_v1 = expected_v1_paths - set(paths)

    assert not missing_v1, sorted(missing_v1)

    missing = expected_paths - set(paths)

    assert missing == set()

    expected_methods = {
        "/query": {"post"},
        "/planner/intent": {"post"},
        "/feedback": {"post"},
        "/requests": {"get"},
        "/requests/{request_id}": {"get"},
        "/requests/{request_id}/map-layers": {"get"},
        "/requests/{request_id}/outputs": {"get"},
        "/requests/{request_id}/outputs/save": {"post"},
        "/requests/{request_id}/outputs/files": {"get"},
        "/requests/{request_id}/outputs/files/{filename}": {"get"},
        "/requests/{request_id}/documents/{filename}": {"get"},
        "/uploads/raster": {"post"},
        "/uploads/vector": {"post"},
        "/uploads": {"get"},
        "/uploads/{upload_id}": {"get"},
        "/uploads/{upload_id}/file": {"get"},
        "/projects": {"get", "post"},
        "/projects/{project_id}": {"get"},
        "/projects/{project_id}/data-sources": {"get"},
        "/plugins": {"get"},
        "/plugins/{plugin_id}": {"get", "patch"},
        "/plugins/{plugin_id}/config": {"get", "put"},
        "/settings/runtime": {"get"},
        "/settings/llm/smoke-test": {"post"},
        "/weights": {"get"},
        "/weights/save": {"post"},
        "/weights/reload": {"post"},
        "/weights/proposals/apply": {"post"},
    }

    for route_path, methods in expected_methods.items():
        exposed_methods = {
            method.lower()
            for method in paths[route_path]
            if method.lower() not in {"parameters"}
        }

        assert methods <= exposed_methods


FRONTEND_NDVI_QUERY = (
    "از تصویر ماهواره ای NDVI بگیر و مناطقی که NDVI آنها بیشتر از 0.3 است "
    "را به پلیگون تبدیل کن"
)

FRONTEND_SATELLITE_RASTER_2BAND = {
    "data": [
        [
            [0.1, 0.1],
            [0.1, 0.8],
        ],
        [
            [0.8, 0.8],
            [0.8, 0.1],
        ],
    ],
    "metadata": {
        "crs": "EPSG:3857",
        "transform": [
            10.0,
            0.0,
            5716470.0,
            0.0,
            -10.0,
            4257980.0,
        ],
    },
}


STANDARD_OUTPUT_BUCKET_KEYS = [
    "vectors",
    "rasters",
    "tables",
    "documents",
    "reports",
    "files",
    "artifacts",
]


def _has_standard_output_buckets(outputs: dict[str, Any]) -> bool:
    return all(
        key in outputs and isinstance(outputs[key], list)
        for key in STANDARD_OUTPUT_BUCKET_KEYS
    )


def _assert_standard_output_buckets(outputs: dict[str, Any]) -> None:
    assert isinstance(outputs, dict)

    for key in STANDARD_OUTPUT_BUCKET_KEYS:
        assert key in outputs
        assert isinstance(outputs[key], list)


def _assert_query_outputs_payload(outputs: dict[str, Any]) -> None:
    """
    /query remains backward-compatible with older direct/legacy response shapes.

    Persisted outputs expose the normalized bucket contract through
    /requests/{request_id}/outputs.  The immediate /query response may either
    already expose those buckets or expose a legacy summary payload.
    """
    assert isinstance(outputs, dict)

    if _has_standard_output_buckets(outputs):
        return

    assert "summary" in outputs
    assert isinstance(outputs["summary"], dict)


def test_frontend_query_to_persisted_outputs_response_contract(tmp_path: Path) -> None:
    client = _client(tmp_path)

    request_id = "req-frontend-api-surface-001"

    query_response = client.post(
        "/query",
        json={
            "query": FRONTEND_NDVI_QUERY,
            "inputs": {
                "raster": FRONTEND_SATELLITE_RASTER_2BAND,
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

    assert query_payload["request_id"] == request_id
    assert query_payload["status"] == "success"
    assert isinstance(query_payload.get("message"), str)
    assert isinstance(query_payload["metadata"], dict)

    _assert_query_outputs_payload(query_payload["outputs"])

    # Immediate /query responses may still use legacy/direct shapes, but should
    # remain safe for frontend consumption.
    assert isinstance(query_payload.get("layers", []), list)

    query_map = query_payload.get("map", {})
    assert isinstance(query_map, dict)
    assert isinstance(query_map.get("layers", []), list)

    for key in [
        "documents",
        "reports",
        "files",
        "artifacts",
    ]:
        assert isinstance(query_payload.get(key, []), list)

    request_response = client.get(
        f"/requests/{request_id}"
    )

    assert request_response.status_code == 200

    request_record = request_response.json()

    assert request_record["request_id"] == request_id
    assert isinstance(request_record.get("production_response"), dict)
    assert request_record["production_response"]["status"] == "success"

    outputs_response = client.get(
        f"/requests/{request_id}/outputs"
    )

    assert outputs_response.status_code == 200

    manifest = outputs_response.json()

    assert manifest["request_id"] == request_id

    # `files` is the persisted physical file manifest.
    assert isinstance(manifest["files"], list)
    assert any(item["filename"] == "manifest.json" for item in manifest["files"])
    assert any(item["filename"] == "output_contract.json" for item in manifest["files"])

    # Normalized frontend-facing output contract.
    _assert_standard_output_buckets(manifest["outputs"])

    assert manifest["output_buckets"] == manifest["outputs"]
    assert isinstance(manifest["layers"], list)
    assert isinstance(manifest["map"], dict)
    assert manifest["map"]["layers"] == manifest["layers"]
    assert isinstance(manifest["artifacts"], list)
    assert isinstance(manifest["documents"], list)
    assert isinstance(manifest["reports"], list)
    assert isinstance(manifest["rasters"], list)
    assert isinstance(manifest["vectors"], list)
    assert isinstance(manifest["tables"], list)
    assert isinstance(manifest["output_files"], list)

    map_layers_response = client.get(
        f"/requests/{request_id}/map-layers"
    )

    assert map_layers_response.status_code == 200

    map_layers = map_layers_response.json()

    assert map_layers["request_id"] == request_id
    assert isinstance(map_layers["layers"], list)
    assert isinstance(map_layers["layer_count"], int)
    assert isinstance(map_layers["warnings"], list)
    assert map_layers["layer_count"] == len(map_layers["layers"])

    # /map-layers and persisted manifest must stay in parity for frontend use.
    assert map_layers["layers"] == manifest["layers"]
    assert map_layers["layer_count"] == len(manifest["layers"])

    assert map_layers["layers"]

    layer = map_layers["layers"][0]

    assert layer["kind"] == "vector"
    assert layer["crs"] == "EPSG:4326"
    assert layer["source_crs"] == "EPSG:3857"
    assert layer["geojson"]["type"] == "FeatureCollection"
    assert isinstance(layer["geojson"]["features"], list)
    assert layer["feature_count"] == len(layer["geojson"]["features"])

    output_files_response = client.get(
        f"/requests/{request_id}/outputs/files"
    )

    assert output_files_response.status_code == 200

    output_files = output_files_response.json()

    assert isinstance(output_files, list)
    assert output_files

    filenames = {
        item["filename"]
        for item in output_files
    }

    assert {
        "manifest.json",
        "production_response.json",
        "audit_record.json",
        "outputs_summary.json",
        "request_metadata.json",
        "map_layers.json",
        "run_result_light.json",
        "output_contract.json",
    } <= filenames

    for item in output_files:
        assert isinstance(item["filename"], str)
        assert isinstance(item["kind"], str)
        assert isinstance(item["media_type"], str)
        assert isinstance(item["size_bytes"], int)
        assert item["size_bytes"] >= 0

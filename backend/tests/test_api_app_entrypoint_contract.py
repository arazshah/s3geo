from __future__ import annotations

from fastapi.testclient import TestClient

import api.main
from api.main import create_app


_REQUIRED_FRONTEND_PATHS = {
    "/",
    "/health",
    "/query",
    "/requests",
    "/requests/{request_id}",
    "/requests/{request_id}/outputs",
    "/requests/{request_id}/map-layers",
    "/requests/{request_id}/outputs/files",
    "/requests/{request_id}/outputs/files/{filename}",
    "/requests/{request_id}/documents/{filename}",
    "/uploads",
    "/uploads/vector",
    "/uploads/raster",
    "/projects",
    "/plugins",
    "/settings/runtime",
}

_REQUIRED_V1_FRONTEND_PATHS = {
    "/api/v1/query",
    "/api/v1/feedback",
    "/api/v1/planner/intent",
    "/api/v1/requests",
    "/api/v1/requests/{request_id}",
    "/api/v1/requests/{request_id}/outputs",
    "/api/v1/requests/{request_id}/map-layers",
    "/api/v1/requests/{request_id}/outputs/files",
    "/api/v1/requests/{request_id}/outputs/files/{filename}",
    "/api/v1/requests/{request_id}/documents/{filename}",
    "/api/v1/uploads",
    "/api/v1/uploads/vector",
    "/api/v1/uploads/raster",
    "/api/v1/projects",
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


def _openapi_paths(app) -> set[str]:
    client = TestClient(app)
    response = client.get("/openapi.json")
    assert response.status_code == 200
    payload = response.json()
    return set(payload.get("paths", {}).keys())


def test_create_app_registers_full_frontend_api_surface() -> None:
    paths = _openapi_paths(create_app())

    assert len(paths) >= 60
    assert _REQUIRED_FRONTEND_PATHS <= paths
    assert _REQUIRED_V1_FRONTEND_PATHS <= paths


def test_uvicorn_entrypoint_app_registers_full_frontend_api_surface() -> None:
    app = getattr(api.main, "app", None)

    assert app is not None

    paths = _openapi_paths(app)

    assert len(paths) >= 60
    assert _REQUIRED_FRONTEND_PATHS <= paths
    assert _REQUIRED_V1_FRONTEND_PATHS <= paths

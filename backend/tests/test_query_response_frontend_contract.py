from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from api.main import create_app


class FakeQueryService:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def handle_query(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(kwargs)

        return {
            "status": "completed",
            "request_id": kwargs.get("request_id") or "req-frontend-query-contract",
            "answer": "تحلیل انجام شد.",
            "outputs": {
                "vectors": [],
                "rasters": [],
                "tables": [],
                "reports": [],
                "documents": [],
                "files": [],
                "artifacts": [],
            },
            "layers": [
                {
                    "id": "layer-1",
                    "name": "Test layer",
                    "type": "vector",
                    "visible": True,
                }
            ],
            "map": {
                "layers": [
                    {
                        "id": "layer-1",
                        "name": "Test layer",
                        "type": "vector",
                        "visible": True,
                    }
                ]
            },
            "documents": [],
            "files": [],
            "reports": [],
            "artifacts": [],
            "warnings": [],
            "metadata": {
                "service": "FakeQueryService",
            },
        }


class FailingQueryService:
    def handle_query(self, **kwargs: Any) -> dict[str, Any]:
        return {
            "status": "failed",
            "request_id": kwargs.get("request_id") or "req-failed-query-contract",
            "answer": "در اجرای درخواست خطا رخ داد.",
            "message": "در اجرای درخواست خطا رخ داد.",
            "outputs": {},
            "layers": [],
            "map": {"layers": []},
            "documents": [],
            "files": [],
            "reports": [],
            "artifacts": [],
            "warnings": ["اجرای درخواست ناموفق بود."],
            "metadata": {"service": "FailingQueryService"},
            "structured_error": {
                "code": "service.test_error",
                "message": "test error",
                "category": "test",
                "retryable": False,
            },
        }


def test_v1_query_accepts_plain_query_and_defaults_inputs() -> None:
    service = FakeQueryService()
    client = TestClient(create_app(service=service))  # type: ignore[arg-type]

    response = client.post(
        "/api/v1/query",
        json={
            "query": "یک تحلیل ساده تستی انجام بده",
            "request_id": "req-ui-contract-001",
        },
    )

    assert response.status_code == 200

    assert service.calls
    call = service.calls[0]

    assert call["query"] == "یک تحلیل ساده تستی انجام بده"
    assert call["inputs"] == {}
    assert call["band_map"] == {}
    assert call["request_id"] == "req-ui-contract-001"
    assert call["user_context"] == {}
    assert call["metadata"] == {}
    assert call["min_score"] is None
    assert call["project_id"] is None

    payload = response.json()

    assert payload["status"] == "completed"
    assert payload["request_id"] == "req-ui-contract-001"
    assert payload["query"] == "یک تحلیل ساده تستی انجام بده"
    assert payload["ok"] is True
    assert payload["summary"] == "تحلیل انجام شد."

    assert isinstance(payload["outputs"], dict)
    assert isinstance(payload["layers"], list)
    assert isinstance(payload["map_layers"], list)
    assert isinstance(payload["map"], dict)
    assert payload["map_layers"] == payload["layers"]
    assert payload["map"]["layers"] == payload["layers"]

    for key in [
        "documents",
        "files",
        "reports",
        "artifacts",
        "warnings",
        "errors",
        "next_actions",
        "trace",
        "steps",
    ]:
        assert key in payload
        assert isinstance(payload[key], list)

    assert payload["errors"] == []
    assert isinstance(payload["metadata"], dict)
    assert isinstance(payload["confidence"], dict)
    assert isinstance(payload["audit_ref"], dict)


def test_v1_query_failed_response_exposes_errors_list() -> None:
    client = TestClient(create_app(service=FailingQueryService()))  # type: ignore[arg-type]

    response = client.post(
        "/api/v1/query",
        json={"query": "یک درخواست خطادار تستی"},
    )

    assert response.status_code == 200

    payload = response.json()

    assert payload["status"] == "failed"
    assert payload["ok"] is False
    assert payload["query"] == "یک درخواست خطادار تستی"
    assert payload["summary"] == "در اجرای درخواست خطا رخ داد."
    assert isinstance(payload["errors"], list)
    assert payload["errors"]
    assert payload["errors"][0]["code"] == "service.test_error"


def test_query_openapi_exposes_frontend_request_and_response_schema() -> None:
    client = TestClient(create_app(service=FakeQueryService()))  # type: ignore[arg-type]

    response = client.get("/openapi.json")

    assert response.status_code == 200

    openapi = response.json()
    schemas = openapi["components"]["schemas"]

    assert "QueryRequest" in schemas
    assert "QueryResponse" in schemas

    request_props = schemas["QueryRequest"]["properties"]
    response_props = schemas["QueryResponse"]["properties"]

    for key in [
        "query",
        "inputs",
        "band_map",
        "request_id",
        "user_context",
        "metadata",
        "min_score",
        "project_id",
    ]:
        assert key in request_props

    for key in [
        "status",
        "request_id",
        "query",
        "ok",
        "answer",
        "message",
        "summary",
        "outputs",
        "layers",
        "map_layers",
        "map",
        "documents",
        "files",
        "reports",
        "artifacts",
        "warnings",
        "errors",
        "metadata",
        "confidence",
        "audit_ref",
        "trace",
        "steps",
        "structured_error",
    ]:
        assert key in response_props

    for path in ["/query", "/api/v1/query"]:
        operation = openapi["paths"][path]["post"]

        request_schema = operation["requestBody"]["content"]["application/json"]["schema"]
        response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]

        assert request_schema["$ref"] == "#/components/schemas/QueryRequest"
        assert response_schema["$ref"] == "#/components/schemas/QueryResponse"

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from api.main import create_app


class FakeOutputService:
    def list_requests(self) -> list[dict[str, Any]]:
        return [
            {
                "request_id": "req-output-contract",
                "status": "success",
                "query": "query",
                "production_response": {"status": "success"},
            }
        ]

    def get_request(self, request_id: str) -> dict[str, Any]:
        return {
            "request_id": request_id,
            "status": "success",
            "query": "query",
            "production_response": {"status": "success"},
            "metadata": {"source": "fake"},
            "outputs_summary": {},
            "audit_record": {},
        }

    def get_output_manifest(self, request_id: str) -> dict[str, Any]:
        buckets = {
            "vectors": [],
            "rasters": [],
            "tables": [],
            "documents": [],
            "reports": [],
            "files": [],
            "artifacts": [],
        }

        return {
            "request_id": request_id,
            "schema_version": "1.0.0",
            "status": "success",
            "files": [
                {
                    "filename": "manifest.json",
                    "kind": "manifest",
                    "media_type": "application/json",
                    "size_bytes": 10,
                    "download_url": f"/api/v1/requests/{request_id}/outputs/files/manifest.json",
                }
            ],
            "outputs": buckets,
            "output_buckets": buckets,
            "layers": [
                {
                    "id": "layer-1",
                    "kind": "vector",
                    "name": "Layer",
                    "geojson": {"type": "FeatureCollection", "features": []},
                }
            ],
            "map": {
                "layers": [
                    {
                        "id": "layer-1",
                        "kind": "vector",
                        "name": "Layer",
                        "geojson": {"type": "FeatureCollection", "features": []},
                    }
                ]
            },
            "artifacts": [],
            "documents": [],
            "reports": [],
            "rasters": [],
            "vectors": [],
            "tables": [],
            "output_files": [],
            "warnings": [],
            "metadata": {"source": "fake"},
        }

    def save_request_outputs(self, request_id: str) -> dict[str, Any]:
        return self.get_output_manifest(request_id)

    def get_map_layers(self, request_id: str) -> dict[str, Any]:
        layers = self.get_output_manifest(request_id)["layers"]

        return {
            "request_id": request_id,
            "layers": layers,
            "layer_count": len(layers),
            "warnings": [],
            "metadata": {"source": "fake"},
        }

    def list_output_files(self, request_id: str) -> list[dict[str, Any]]:
        return self.get_output_manifest(request_id)["files"]


def test_v1_request_outputs_map_layers_and_files_have_frontend_contract() -> None:
    client = TestClient(create_app(service=FakeOutputService()))  # type: ignore[arg-type]

    request_id = "req-output-contract"

    request_response = client.get(f"/api/v1/requests/{request_id}")
    assert request_response.status_code == 200

    request_payload = request_response.json()

    assert request_payload["request_id"] == request_id
    assert request_payload["status"] == "success"
    assert isinstance(request_payload["production_response"], dict)

    outputs_response = client.get(f"/api/v1/requests/{request_id}/outputs")
    assert outputs_response.status_code == 200

    manifest = outputs_response.json()

    assert manifest["request_id"] == request_id
    assert manifest["schema_version"] == "1.0.0"
    assert isinstance(manifest["files"], list)
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
    assert manifest["map"]["layers"] == manifest["layers"]

    for key in [
        "artifacts",
        "documents",
        "reports",
        "rasters",
        "vectors",
        "tables",
        "output_files",
        "warnings",
    ]:
        assert key in manifest
        assert isinstance(manifest[key], list)

    map_layers_response = client.get(f"/api/v1/requests/{request_id}/map-layers")
    assert map_layers_response.status_code == 200

    map_layers = map_layers_response.json()

    assert map_layers["request_id"] == request_id
    assert isinstance(map_layers["layers"], list)
    assert isinstance(map_layers["layer_count"], int)
    assert isinstance(map_layers["warnings"], list)
    assert map_layers["layer_count"] == len(map_layers["layers"])
    assert map_layers["layers"] == manifest["layers"]

    files_response = client.get(f"/api/v1/requests/{request_id}/outputs/files")
    assert files_response.status_code == 200

    files = files_response.json()

    assert isinstance(files, list)
    assert files

    first_file = files[0]

    assert isinstance(first_file["filename"], str)
    assert isinstance(first_file["kind"], str)
    assert isinstance(first_file["media_type"], str)
    assert isinstance(first_file["size_bytes"], int)
    assert isinstance(first_file["download_url"], str)

    save_response = client.post(f"/api/v1/requests/{request_id}/outputs/save")
    assert save_response.status_code == 200
    assert save_response.json()["request_id"] == request_id


def test_output_openapi_exposes_frontend_response_schemas() -> None:
    client = TestClient(create_app(service=FakeOutputService()))  # type: ignore[arg-type]

    response = client.get("/openapi.json")

    assert response.status_code == 200

    openapi = response.json()
    schemas = openapi["components"]["schemas"]

    for name in [
        "RequestRecordResponse",
        "OutputManifestResponse",
        "OutputBucketsResponse",
        "MapLayersResponse",
        "OutputFileInfoResponse",
    ]:
        assert name in schemas

    expected_refs = {
        "/api/v1/requests/{request_id}": ("get", "RequestRecordResponse"),
        "/api/v1/requests/{request_id}/outputs": ("get", "OutputManifestResponse"),
        "/api/v1/requests/{request_id}/map-layers": ("get", "MapLayersResponse"),
        "/api/v1/requests/{request_id}/outputs/save": ("post", "OutputManifestResponse"),
    }

    for path, (method, schema_name) in expected_refs.items():
        operation = openapi["paths"][path][method]
        schema = operation["responses"]["200"]["content"]["application/json"]["schema"]

        assert schema["$ref"] == f"#/components/schemas/{schema_name}"

    files_operation = openapi["paths"]["/api/v1/requests/{request_id}/outputs/files"]["get"]
    files_schema = files_operation["responses"]["200"]["content"]["application/json"]["schema"]

    assert files_schema["type"] == "array"
    assert files_schema["items"]["$ref"] == "#/components/schemas/OutputFileInfoResponse"

    output_download_content = openapi["paths"][
        "/api/v1/requests/{request_id}/outputs/files/{filename}"
    ]["get"]["responses"]["200"]["content"]

    document_download_content = openapi["paths"][
        "/api/v1/requests/{request_id}/documents/{filename}"
    ]["get"]["responses"]["200"]["content"]

    assert "application/octet-stream" in output_download_content
    assert "application/pdf" in document_download_content
    assert "text/html" in document_download_content

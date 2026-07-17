from __future__ import annotations

import json
import mimetypes
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from api.support import (
    http_error_detail as _http_error_detail,
    json_safe as _json_safe,
    service as _service,
)
from orchestrator.runtime_paths import RuntimePaths
from orchestrator.service import OrchestratorServiceError


router = APIRouter()


class OutputBucketsResponse(BaseModel):
    """
    Normalized frontend-facing output buckets.

    Additional keys are allowed so new output types can be added without
    breaking older UI clients.
    """

    vectors: list[Any] = Field(default_factory=list)
    rasters: list[Any] = Field(default_factory=list)
    tables: list[Any] = Field(default_factory=list)
    documents: list[Any] = Field(default_factory=list)
    reports: list[Any] = Field(default_factory=list)
    files: list[Any] = Field(default_factory=list)
    artifacts: list[Any] = Field(default_factory=list)

    model_config = ConfigDict(extra="allow")


class OutputFileInfoResponse(BaseModel):
    """
    Public file metadata returned by /requests/{request_id}/outputs/files.
    """

    filename: str | None = Field(default=None)
    kind: str | None = Field(default=None)
    media_type: str | None = Field(default=None)
    size_bytes: int | None = Field(default=None)
    path: str | None = Field(default=None)
    download_url: str | None = Field(default=None)

    model_config = ConfigDict(extra="allow")


class RequestRecordResponse(BaseModel):
    """
    Frontend-facing request record.

    The request store may include additional service/audit fields; they remain
    available through extra properties.
    """

    request_id: str | None = Field(default=None)
    status: str | None = Field(default=None)
    query: str | None = Field(default=None)
    production_response: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    outputs_summary: dict[str, Any] = Field(default_factory=dict)
    audit_record: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class OutputManifestResponse(BaseModel):
    """
    Persisted output manifest contract used by the frontend.

    `files` is the physical persisted-file manifest.
    `outputs`/`output_buckets` are the normalized logical output buckets.
    """

    request_id: str | None = Field(default=None)
    schema_version: str | None = Field(default=None)
    status: str | None = Field(default=None)

    files: list[OutputFileInfoResponse] = Field(default_factory=list)
    outputs: OutputBucketsResponse = Field(default_factory=OutputBucketsResponse)
    output_buckets: OutputBucketsResponse = Field(default_factory=OutputBucketsResponse)

    layers: list[dict[str, Any]] = Field(default_factory=list)
    map: dict[str, Any] = Field(default_factory=dict)

    artifacts: list[Any] = Field(default_factory=list)
    documents: list[Any] = Field(default_factory=list)
    reports: list[Any] = Field(default_factory=list)
    rasters: list[Any] = Field(default_factory=list)
    vectors: list[Any] = Field(default_factory=list)
    tables: list[Any] = Field(default_factory=list)
    output_files: list[Any] = Field(default_factory=list)

    warnings: list[Any] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


class MapLayersResponse(BaseModel):
    """
    Leaflet/frontend-ready map layer response.
    """

    request_id: str | None = Field(default=None)
    layers: list[dict[str, Any]] = Field(default_factory=list)
    layer_count: int = Field(default=0)
    warnings: list[Any] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


_FILE_DOWNLOAD_RESPONSES = {
    200: {
        "description": "Binary or text output file.",
        "content": {
            "application/octet-stream": {
                "schema": {
                    "type": "string",
                    "format": "binary",
                }
            }
        },
    }
}

_DOCUMENT_DOWNLOAD_RESPONSES = {
    200: {
        "description": "Generated request document.",
        "content": {
            "application/pdf": {
                "schema": {
                    "type": "string",
                    "format": "binary",
                }
            },
            "text/html": {
                "schema": {
                    "type": "string",
                    "format": "binary",
                }
            },
            "application/json": {
                "schema": {
                    "type": "string",
                    "format": "binary",
                }
            },
            "application/octet-stream": {
                "schema": {
                    "type": "string",
                    "format": "binary",
                }
            },
        },
    }
}


_DOCUMENT_MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".html": "text/html",
    ".json": "application/json",
    ".geojson": "application/geo+json",
    ".csv": "text/csv",
    ".txt": "text/plain",
}


def _document_media_type(filename: str) -> str:
    return _DOCUMENT_MEDIA_TYPES.get(
        Path(filename).suffix.lower(),
        "application/octet-stream",
    )


def _fallback_document_file_path(
    request_id: str,
    filename: str,
) -> Path:
    """
    Fallback used by focused unit tests that call the route function directly
    without a FastAPI Request/service instance.
    """
    safe_filename = Path(filename).name

    if safe_filename != filename:
        raise HTTPException(
            status_code=404,
            detail="Unknown document file.",
        )

    if not request_id or request_id not in safe_filename:
        raise HTTPException(
            status_code=404,
            detail="Unknown document file.",
        )

    reports_dir = RuntimePaths.from_env().reports
    file_path = reports_dir / safe_filename

    try:
        resolved_reports_dir = reports_dir.resolve()
        resolved_file_path = file_path.resolve()
    except OSError as exc:
        raise HTTPException(
            status_code=404,
            detail="Unknown document file.",
        ) from exc

    if (
        resolved_reports_dir not in resolved_file_path.parents
        or not resolved_file_path.is_file()
    ):
        raise HTTPException(
            status_code=404,
            detail="Unknown document file.",
        )

    return resolved_file_path


@router.get("/requests", response_model=list[RequestRecordResponse])
def list_requests(request: Request) -> list[dict[str, Any]]:
    svc = _service(request)
    return _json_safe(svc.list_requests())


@router.get("/requests/{request_id}", response_model=RequestRecordResponse)
def get_request(
    request: Request,
    request_id: str,
) -> dict[str, Any]:
    svc = _service(request)
    record = svc.get_request(request_id)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown request_id: {request_id}",
        )

    return _json_safe(record)


@router.get("/requests/{request_id}/map-layers", response_model=MapLayersResponse)
def get_request_map_layers(
    request: Request,
    request_id: str,
) -> dict[str, Any]:
    """
    Return Leaflet-ready map layers for a previous request.
    """
    svc = _service(request)

    try:
        return _json_safe(svc.get_map_layers(request_id))
    except OrchestratorServiceError as exc:
        if "Unknown request_id" in str(exc):
            raise HTTPException(
                status_code=404,
                detail=_http_error_detail(exc),
            ) from exc

        raise HTTPException(
            status_code=400,
            detail=_http_error_detail(exc),
        ) from exc


@router.get("/requests/{request_id}/outputs", response_model=OutputManifestResponse)
def get_request_outputs(
    request: Request,
    request_id: str,
) -> dict[str, Any]:
    """
    Return persisted output manifest for a request.
    """
    svc = _service(request)

    try:
        return _json_safe(svc.get_output_manifest(request_id))
    except OrchestratorServiceError as exc:
        raise HTTPException(
            status_code=404,
            detail=_http_error_detail(exc),
        ) from exc


@router.post("/requests/{request_id}/outputs/save", response_model=OutputManifestResponse)
def save_request_outputs(
    request: Request,
    request_id: str,
) -> dict[str, Any]:
    """
    Persist outputs for a request again.
    """
    svc = _service(request)

    try:
        return _json_safe(svc.save_request_outputs(request_id))
    except OrchestratorServiceError as exc:
        if "Unknown request_id" in str(exc):
            raise HTTPException(
                status_code=404,
                detail=_http_error_detail(exc),
            ) from exc

        raise HTTPException(
            status_code=400,
            detail=_http_error_detail(exc),
        ) from exc


@router.get("/requests/{request_id}/outputs/files", response_model=list[OutputFileInfoResponse])
def list_request_output_files(
    request: Request,
    request_id: str,
) -> list[dict[str, Any]]:
    """
    List persisted output files for a request.
    """
    svc = _service(request)

    try:
        return _json_safe(svc.list_output_files(request_id))
    except OrchestratorServiceError as exc:
        raise HTTPException(
            status_code=404,
            detail=_http_error_detail(exc),
        ) from exc


@router.get(
    "/requests/{request_id}/outputs/files/{filename}",
    response_class=FileResponse,
    responses=_FILE_DOWNLOAD_RESPONSES,
)
def download_request_output_file(
    request: Request,
    request_id: str,
    filename: str,
) -> FileResponse:
    """
    Download one persisted output file.
    """
    svc = _service(request)

    try:
        file_path = svc.get_output_file_path(
            request_id,
            filename,
        )
    except OrchestratorServiceError as exc:
        raise HTTPException(
            status_code=404,
            detail=_http_error_detail(exc),
        ) from exc

    return FileResponse(
        path=file_path,
        media_type=svc.get_output_file_media_type(filename),
        filename=filename,
    )


@router.get(
    "/requests/{request_id}/documents/{filename}",
    response_class=FileResponse,
    responses=_DOCUMENT_DOWNLOAD_RESPONSES,
)
def download_request_document(
    request: Request,
    request_id: str,
    filename: str,
) -> FileResponse:
    """
    Download a generated document for a request.

    Security policy:
    - serves files from the configured reports runtime directory
    - blocks path traversal
    - requires the filename to be associated with the same request_id
    """
    safe_filename = Path(filename).name

    if safe_filename != filename:
        raise HTTPException(
            status_code=404,
            detail="Unknown document file.",
        )

    # Focused unit tests may call this function directly with request=None.
    if request is None:
        resolved_file_path = _fallback_document_file_path(
            request_id,
            safe_filename,
        )
        media_type = _document_media_type(safe_filename)
    else:
        svc = _service(request)

        try:
            resolved_file_path = svc.get_document_file_path(
                request_id,
                safe_filename,
            )
            media_type = svc.get_document_file_media_type(safe_filename)
        except OrchestratorServiceError as exc:
            raise HTTPException(
                status_code=404,
                detail=_http_error_detail(exc),
            ) from exc

    return FileResponse(
        path=resolved_file_path,
        media_type=media_type,
        filename=safe_filename,
    )


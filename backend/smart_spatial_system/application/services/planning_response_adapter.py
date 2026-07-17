"""
Planning response adapter.

Small output-facing helpers for converting planning execution results into
production response payload fragments.

This module intentionally contains no query execution orchestration.
"""

from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any


def json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, dict):
        return {
            str(key): json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple, set)):
        return [
            json_safe(item)
            for item in value
        ]

    if hasattr(value, "to_dict") and callable(value.to_dict):
        return json_safe(value.to_dict())

    if is_dataclass(value):
        return json_safe(asdict(value))

    payload = getattr(value, "__dict__", None)

    if isinstance(payload, dict) and payload:
        return json_safe(payload)

    return repr(value)


def is_feature_collection(value: Any) -> bool:
    return (
        isinstance(value, dict)
        and value.get("type") == "FeatureCollection"
        and isinstance(value.get("features"), list)
    )


def planning_trace_to_steps(trace: list[Any]) -> list[dict[str, Any]]:
    steps: list[dict[str, Any]] = []

    for item in trace or []:
        capability_name = getattr(item, "capability_name", None)
        node_id = getattr(item, "node_id", None)
        status = getattr(item, "status", None)
        error = getattr(item, "error", None)
        output_summary = getattr(item, "output_summary", None) or {}

        if error:
            message = error
        elif isinstance(output_summary, dict) and output_summary:
            parts = [f"{k}={v}" for k, v in output_summary.items()]
            message = ", ".join(parts[:6])
        else:
            message = status or ""

        steps.append(
            {
                "label": capability_name or node_id or "step",
                "step": node_id or capability_name or "step",
                "status": status or "unknown",
                "message": message,
            }
        )

    return steps


def _as_feature_collection(value: Any) -> dict[str, Any] | None:
    if is_feature_collection(value):
        return value

    geojson = getattr(value, "geojson", None)
    if is_feature_collection(geojson):
        return geojson

    features = getattr(value, "features", None)
    if isinstance(features, list):
        return {
            "type": "FeatureCollection",
            "features": json_safe(features),
        }

    if isinstance(value, dict) and isinstance(value.get("features"), list):
        return {
            "type": "FeatureCollection",
            "features": json_safe(value.get("features") or []),
        }

    return None


def _bucket_has_source(bucket: Any, source_node: str) -> bool:
    if not isinstance(bucket, list):
        return False

    for item in bucket:
        if not isinstance(item, dict):
            continue

        if item.get("source_node") == source_node:
            return True

        if item.get("name") == source_node:
            return True

        if item.get("source") == source_node:
            return True

    return False


def _artifact_payload_data(artifact: dict[str, Any]) -> Any:
    payload = artifact.get("payload")

    if not isinstance(payload, dict):
        return payload

    if "data" in payload:
        return payload.get("data")

    return payload


def _mirror_artifact_to_output_buckets(
    artifact: dict[str, Any],
    outputs: dict[str, Any],
) -> None:
    """
    Mirror canonical public artifacts into legacy/frontend output buckets.

    `outputs["artifacts"]` remains the canonical normalized list.  The typed
    buckets are compatibility/frontend conveniences used by the API and UI.
    """
    kind = str(artifact.get("kind") or "")
    payload = artifact.get("payload") if isinstance(artifact.get("payload"), dict) else {}
    source_node = str(artifact.get("source_node") or artifact.get("title") or artifact.get("id") or "")
    title = artifact.get("title") or source_node or artifact.get("id")
    artifact_id = artifact.get("id")

    if not source_node:
        return

    if kind == "table":
        if _bucket_has_source(outputs.get("tables"), source_node):
            return

        outputs.setdefault("tables", []).append(
            {
                "name": title,
                "source": "planning.output_nodes",
                "source_node": source_node,
                "artifact_id": artifact_id,
                "rows": payload.get("rows", []),
                "columns": payload.get("columns", []),
                "artifact": artifact,
            }
        )
        return

    if kind == "report":
        if _bucket_has_source(outputs.get("reports"), source_node):
            return

        outputs.setdefault("reports", []).append(
            {
                "name": title,
                "source": "planning.output_nodes",
                "source_node": source_node,
                "artifact_id": artifact_id,
                "data": _artifact_payload_data(artifact),
                "artifact": artifact,
            }
        )
        return

    if kind == "download":
        if _bucket_has_source(outputs.get("files"), source_node):
            return

        file_path = payload.get("path") or payload.get("url")
        outputs.setdefault("files", []).append(
            {
                "name": title,
                "path": file_path,
                "source": "planning.output_nodes",
                "source_node": source_node,
                "format": payload.get("format") or "file",
                "artifact_id": artifact_id,
                "artifact": artifact,
            }
        )
        return

    if kind == "raster_ref":
        if _bucket_has_source(outputs.get("rasters"), source_node):
            return

        raster_path = payload.get("path") or payload.get("url")
        outputs.setdefault("rasters", []).append(
            {
                "name": title,
                "path": raster_path,
                "source": "planning.output_nodes",
                "source_node": source_node,
                "format": payload.get("format") or "raster",
                "artifact_id": artifact_id,
                "artifact": artifact,
            }
        )
        return


def planning_outputs_to_response_payload(
    planning_result: Any,
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any] | None]:
    from orchestrator.kernel_artifacts import (
        artifact_to_public_dict,
        output_to_artifact,
    )

    layers: list[dict[str, Any]] = []
    outputs: dict[str, Any] = {
        "files": [],
        "vectors": [],
        "tables": [],
        "rasters": [],
        "documents": [],
        "reports": [],
        "artifacts": [],
    }
    primary_report: dict[str, Any] | None = None

    for node_id, value in (getattr(planning_result, "output_nodes", None) or {}).items():
        public_artifact: dict[str, Any] | None = None

        try:
            artifact = output_to_artifact(
                value,
                source_node=node_id,
                title=node_id,
                produced_by="query_spec_planning",
                metadata={
                    "source": "planning.output_nodes",
                },
            )
            public_artifact = artifact_to_public_dict(artifact)
            outputs["artifacts"].append(public_artifact)
            _mirror_artifact_to_output_buckets(public_artifact, outputs)
        except Exception as exc:
            outputs.setdefault("artifact_errors", []).append(
                {
                    "node_id": node_id,
                    "error": f"{type(exc).__name__}: {exc}",
                }
            )

        if (
            isinstance(public_artifact, dict)
            and public_artifact.get("kind") == "report"
            and primary_report is None
        ):
            report_payload = _artifact_payload_data(public_artifact)
            if isinstance(report_payload, dict):
                primary_report = report_payload

        feature_collection = _as_feature_collection(value)

        if feature_collection is not None:
            layer = {
                "id": node_id,
                "name": node_id,
                "type": "vector",
                "format": "geojson",
                "geojson": feature_collection,
                "summary": {
                    "feature_count": len(feature_collection.get("features", [])),
                },
            }
            layers.append(layer)
            outputs["vectors"].append(layer)
            continue

        safe_value = json_safe(value)

        if isinstance(safe_value, dict):
            if any(
                key in safe_value
                for key in ("title", "summary", "sections", "rankings", "table", "rows")
            ):
                if primary_report is None:
                    primary_report = safe_value

                if (
                    not _bucket_has_source(outputs.get("tables"), node_id)
                    and not _bucket_has_source(outputs.get("reports"), node_id)
                ):
                    outputs["tables"].append(
                        {
                            "name": node_id,
                            "source": "planning.output_nodes",
                            "data": safe_value,
                        }
                    )

            for key in ("path", "file_path", "output_path", "pdf_path"):
                file_path = safe_value.get(key)
                if isinstance(file_path, str) and file_path:
                    if not _bucket_has_source(outputs.get("files"), node_id):
                        outputs["files"].append(
                            {
                                "name": safe_value.get("name") or node_id,
                                "path": file_path,
                                "source": "planning.output_nodes",
                                "format": (
                                    "pdf"
                                    if str(file_path).lower().endswith(".pdf")
                                    else "file"
                                ),
                            }
                        )
                    break

            continue

        if isinstance(value, str) and value.lower().endswith(".pdf"):
            outputs["files"].append(
                {
                    "name": node_id,
                    "path": value,
                    "source": "planning.output_nodes",
                    "format": "pdf",
                }
            )

    return layers, outputs, primary_report

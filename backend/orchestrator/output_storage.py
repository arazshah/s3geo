"""
orchestrator.output_storage

Persistent output storage for operational Smart Spatial System usage.

This module stores request outputs as files:

outputs/
  {request_id}/
    manifest.json
    production_response.json
    audit_record.json
    outputs_summary.json
    map_layers.json
    {layer_name}.geojson

It is intentionally JSON/GeoJSON-first for MVP.
Later it can be extended to:
    - GeoTIFF rasters
    - COG
    - MBTiles
    - PostGIS persistence
    - object storage such as S3/MinIO
"""

from __future__ import annotations

import json
import mimetypes
import re
from dataclasses import asdict, dataclass, is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


OUTPUT_STORAGE_SCHEMA_VERSION = "1.0.0"


@dataclass(frozen=True)
class OutputStorageConfig:
    root_dir: str | Path = "outputs"
    indent: int = 2
    ensure_ascii: bool = False

    def __post_init__(self) -> None:
        if self.indent < 0:
            raise ValueError("indent must be >= 0.")


class OutputStorageError(RuntimeError):
    pass


class OutputStorage:
    """
    File-based output storage.
    """

    def __init__(
        self,
        config: OutputStorageConfig | None = None,
    ) -> None:
        self.config = config or OutputStorageConfig()
        self.root_dir = Path(self.config.root_dir)

    def request_dir(
        self,
        request_id: str,
    ) -> Path:
        safe_id = _safe_name(request_id)
        return self.root_dir / safe_id

    def save_request_record(
        self,
        record: dict[str, Any],
        *,
        map_layers_payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Save a stored OrchestratorService request record to files.
        """
        request_id = record.get("request_id")

        if not request_id:
            raise OutputStorageError("record missing request_id.")

        directory = self.request_dir(str(request_id))
        directory.mkdir(parents=True, exist_ok=True)

        files: list[dict[str, Any]] = []

        production_response = record.get("production_response") or {}
        audit_record = record.get("audit_record") or {}
        run_result = record.get("run_result") or {}

        # Preferred source is the normalized stored request record.
        # The following fallbacks preserve compatibility with legacy records.
        outputs_summary = (
            record.get("outputs_summary")
            if isinstance(record.get("outputs_summary"), dict)
            else None
        )

        if outputs_summary is None and isinstance(production_response, dict):
            candidate = production_response.get("outputs_summary")
            if isinstance(candidate, dict):
                outputs_summary = candidate

        if outputs_summary is None and isinstance(production_response, dict):
            response_outputs = production_response.get("outputs")
            if isinstance(response_outputs, dict):
                candidate = response_outputs.get("summary")
                if isinstance(candidate, dict):
                    outputs_summary = candidate

        if outputs_summary is None and isinstance(audit_record, dict):
            candidate = audit_record.get("outputs_summary")
            if isinstance(candidate, dict):
                outputs_summary = candidate

        public_output_contract = _public_output_contract(
            production_response,
            map_layers_payload=map_layers_payload,
        )

        files.append(
            self._write_json(
                directory / "production_response.json",
                production_response,
                kind="production_response",
            )
        )

        files.append(
            self._write_json(
                directory / "audit_record.json",
                audit_record,
                kind="audit_record",
            )
        )

        files.append(
            self._write_json(
                directory / "outputs_summary.json",
                outputs_summary or {},
                kind="outputs_summary",
            )
        )

        # Store lightweight request metadata.
        request_metadata = {
            "request_id": request_id,
            "query": record.get("query"),
            "band_map": record.get("band_map"),
            "user_context": record.get("user_context"),
            "metadata": record.get("metadata"),
            "status": production_response.get("status")
            if isinstance(production_response, dict)
            else None,
            "query_hash": production_response.get("query_hash")
            if isinstance(production_response, dict)
            else None,
        }

        files.append(
            self._write_json(
                directory / "request_metadata.json",
                request_metadata,
                kind="request_metadata",
            )
        )

        if map_layers_payload is not None:
            files.append(
                self._write_json(
                    directory / "map_layers.json",
                    map_layers_payload,
                    kind="map_layers",
                )
            )

            layers = map_layers_payload.get("layers", [])

            if isinstance(layers, list):
                for layer in layers:
                    if not isinstance(layer, dict):
                        continue

                    geojson = layer.get("geojson")

                    if not isinstance(geojson, dict):
                        continue

                    if geojson.get("type") != "FeatureCollection":
                        continue

                    raw_layer_name = str(layer.get("name") or "layer")
                    layer_name = _safe_name(raw_layer_name)

                    # NDVI vegetation extraction has a stable public output
                    # contract. Internal planner/plugin names such as
                    # ``polygon_vector`` must not leak into the API filename.
                    if layer_name in {
                        "polygon_vector",
                        "vegetation_polygon",
                        "vegetation_polygons_vector",
                    }:
                        layer_name = "vegetation_polygons"

                    filename = f"{layer_name}.geojson"

                    files.append(
                        self._write_json(
                            directory / filename,
                            geojson,
                            kind="geojson",
                            extra={
                                "layer_name": layer.get("name"),
                                "feature_count": layer.get("feature_count"),
                                "crs": layer.get("crs"),
                            },
                        )
                    )

        # Save a JSON-safe lightweight run result if possible.
        # This is useful for debugging and reproducibility.
        files.append(
            self._write_json(
                directory / "run_result_light.json",
                _lightweight_run_result(run_result),
                kind="run_result_light",
            )
        )

        files.append(
            self._write_json(
                directory / "output_contract.json",
                public_output_contract,
                kind="output_contract",
            )
        )

        manifest = {
            "schema_version": OUTPUT_STORAGE_SCHEMA_VERSION,
            "request_id": request_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "root_dir": str(self.root_dir),
            "directory": str(directory),
            "files": files,
            **public_output_contract,
        }

        manifest_file = self._write_json(
            directory / "manifest.json",
            manifest,
            kind="manifest",
        )

        manifest["files"].append(manifest_file)

        # Rewrite final manifest including manifest entry itself.
        self._write_json(
            directory / "manifest.json",
            manifest,
            kind="manifest",
        )

        return manifest

    def manifest_path(
        self,
        request_id: str,
    ) -> Path:
        return self.request_dir(request_id) / "manifest.json"

    def read_manifest(
        self,
        request_id: str,
    ) -> dict[str, Any]:
        path = self.manifest_path(request_id)

        if not path.exists():
            raise OutputStorageError(
                f"Output manifest does not exist for request_id: {request_id}"
            )

        return self._read_json(path)

    def list_files(
        self,
        request_id: str,
    ) -> list[dict[str, Any]]:
        manifest = self.read_manifest(request_id)
        files = manifest.get("files", [])

        if not isinstance(files, list):
            return []

        return files

    def get_file_path(
        self,
        request_id: str,
        filename: str,
    ) -> Path:
        directory = self.request_dir(request_id).resolve()
        path = (directory / filename).resolve()

        try:
            path.relative_to(directory)
        except ValueError as exc:
            raise OutputStorageError("Invalid output file path.") from exc

        if not path.exists() or not path.is_file():
            raise OutputStorageError(
                f"Output file does not exist: {filename}"
            )

        return path

    def get_media_type(
        self,
        filename: str,
    ) -> str:
        if filename.endswith(".geojson"):
            return "application/geo+json"

        guessed, _ = mimetypes.guess_type(filename)

        return guessed or "application/octet-stream"

    def _write_json(
        self,
        path: Path,
        payload: Any,
        *,
        kind: str,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        safe_payload = _json_safe(payload)

        try:
            path.write_text(
                json.dumps(
                    safe_payload,
                    ensure_ascii=self.config.ensure_ascii,
                    indent=self.config.indent,
                ),
                encoding="utf-8",
            )
        except OSError as exc:
            raise OutputStorageError(
                f"Failed to write output file {path}: {exc}"
            ) from exc

        info = {
            "filename": path.name,
            "kind": kind,
            "path": str(path),
            "size_bytes": path.stat().st_size,
            "media_type": self.get_media_type(path.name),
        }

        if extra:
            info.update(extra)

        return info

    @staticmethod
    def _read_json(
        path: Path,
    ) -> dict[str, Any]:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise OutputStorageError(
                f"Invalid JSON output file: {path}: {exc}"
            ) from exc
        except OSError as exc:
            raise OutputStorageError(
                f"Failed to read output file: {path}: {exc}"
            ) from exc

        if not isinstance(payload, dict):
            return {
                "value": payload,
            }

        return payload


STANDARD_OUTPUT_BUCKETS = (
    "vectors",
    "rasters",
    "tables",
    "documents",
    "reports",
    "files",
    "artifacts",
)


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _standard_output_buckets(value: Any) -> dict[str, Any]:
    outputs = dict(value) if isinstance(value, dict) else {}

    for key in STANDARD_OUTPUT_BUCKETS:
        if not isinstance(outputs.get(key), list):
            outputs[key] = []

    return _json_safe(outputs)


def _layers_from_response(
    production_response: dict[str, Any],
    *,
    map_layers_payload: dict[str, Any] | None,
) -> list[Any]:
    if isinstance(map_layers_payload, dict):
        layers = map_layers_payload.get("layers")
        if isinstance(layers, list):
            return layers

    layers = production_response.get("layers")
    if isinstance(layers, list):
        return layers

    map_payload = production_response.get("map")
    if isinstance(map_payload, dict):
        layers = map_payload.get("layers")
        if isinstance(layers, list):
            return layers

    return []


def _list_from_response_or_outputs(
    production_response: dict[str, Any],
    outputs: dict[str, Any],
    key: str,
) -> list[Any]:
    value = production_response.get(key)
    if isinstance(value, list):
        return value

    value = outputs.get(key)
    if isinstance(value, list):
        return value

    return []


def _public_output_contract(
    production_response: Any,
    *,
    map_layers_payload: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Build the frontend-facing output contract stored inside manifest.json.

    `manifest["files"]` is reserved for persisted physical files.  The output
    bucket named `files` is exposed as `manifest["output_files"]` to avoid
    ambiguity while still keeping the full bucket under `manifest["outputs"]`.
    """
    response = _as_dict(production_response)
    outputs = _standard_output_buckets(response.get("outputs"))

    layers = _json_safe(
        _layers_from_response(
            response,
            map_layers_payload=map_layers_payload,
        )
    )

    map_payload = _as_dict(response.get("map"))
    if not map_payload:
        map_payload = {}

    map_payload = dict(map_payload)
    map_payload["layers"] = layers

    artifacts = _json_safe(
        _list_from_response_or_outputs(response, outputs, "artifacts")
    )
    documents = _json_safe(
        _list_from_response_or_outputs(response, outputs, "documents")
    )
    reports = _json_safe(
        _list_from_response_or_outputs(response, outputs, "reports")
    )
    output_files = _json_safe(
        _list_from_response_or_outputs(response, outputs, "files")
    )

    return {
        "outputs": outputs,
        "output_buckets": outputs,
        "artifacts": artifacts,
        "layers": layers,
        "map": _json_safe(map_payload),
        "documents": documents,
        "reports": reports,
        "rasters": _json_safe(_as_list(outputs.get("rasters"))),
        "vectors": _json_safe(_as_list(outputs.get("vectors"))),
        "tables": _json_safe(_as_list(outputs.get("tables"))),
        "output_files": output_files,
    }


def _safe_name(value: str) -> str:
    text = str(value).strip()

    if not text:
        return "unnamed"

    text = re.sub(r"[^A-Za-z0-9_.-]+", "_", text)
    text = text.strip("._")

    return text or "unnamed"


def _lightweight_run_result(
    run_result: Any,
) -> dict[str, Any]:
    if not isinstance(run_result, dict):
        return {}

    result: dict[str, Any] = {}

    for key in [
        "response",
        "audit_record",
    ]:
        if key in run_result:
            result[key] = _json_safe(run_result[key])

    plan = run_result.get("plan")

    if plan is not None:
        result["plan"] = _json_safe(plan)

    return result


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, dict):
        return {
            str(key): _json_safe(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple, set)):
        return [
            _json_safe(item)
            for item in value
        ]

    if hasattr(value, "to_dict") and callable(value.to_dict):
        try:
            return _json_safe(value.to_dict())
        except Exception:
            pass

    if is_dataclass(value):
        try:
            return _json_safe(asdict(value))
        except Exception:
            pass

    payload = getattr(value, "__dict__", None)

    if isinstance(payload, dict) and payload:
        return _json_safe(payload)

    return repr(value)

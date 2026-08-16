from __future__ import annotations

from pathlib import Path

from api.query_request_normalization import normalize_query_inputs
from orchestrator.upload_storage import UploadStorage, UploadStorageConfig
from smart_spatial_system.application.services.query_execution.planning_execution import (
    _add_filename_based_runtime_input_aliases,
)


def _storage(tmp_path: Path) -> UploadStorage:
    return UploadStorage(UploadStorageConfig(root_dir=tmp_path / "uploads"))


def test_selected_vector_is_bound_for_non_display_analysis(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    upload = storage.save_upload(
        filename="scenario.geojson",
        content=b'{"type":"FeatureCollection","features":[]}',
        content_type="application/geo+json",
        kind="vector",
    )

    normalized = normalize_query_inputs(
        query="Analyze the uploaded dataset and rank its features.",
        inputs={},
        data_source_ids=[upload["upload_id"]],
        dataset_ids=None,
        datasets=None,
        upload_storage=storage,
    )

    assert normalized.inputs["vector_ref"] == upload["upload_id"]
    assert normalized.metadata["binding_precedence"] == "selected_dataset_id"


def test_single_vector_runtime_has_uploaded_geojson_compatibility_alias() -> None:
    runtime_inputs = {"vector": {"type": "FeatureCollection", "features": []}}
    final_metadata: dict = {}

    _add_filename_based_runtime_input_aliases(
        runtime_inputs,
        user_context=None,
        metadata=None,
        final_metadata=final_metadata,
    )

    assert runtime_inputs["uploaded_geojson"] is runtime_inputs["vector"]
    assert final_metadata["runtime_input_aliases_added"]["uploaded_geojson"] == "vector"

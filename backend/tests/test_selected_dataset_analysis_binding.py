from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from api.query_request_normalization import normalize_query_inputs
from orchestrator.upload_storage import UploadStorage, UploadStorageConfig
from smart_spatial_system.application.services.query_execution.planning_execution import (
    _add_filename_based_runtime_input_aliases,
    _add_single_vector_query_ref_aliases,
)
from smart_spatial_system.application.services.query_execution.planning_context import (
    _normalize_input_roles,
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


def test_selected_mixed_pair_is_bound_by_dataset_kind(tmp_path: Path) -> None:
    storage = _storage(tmp_path)
    raster = storage.save_upload(
        filename="dem.tif",
        content=b"valid-enough-for-upload-contract",
        content_type="image/tiff",
        kind="raster",
    )
    vector = storage.save_upload(
        filename="zones.geojson",
        content=b'{"type":"FeatureCollection","features":[]}',
        content_type="application/geo+json",
        kind="vector",
    )

    normalized = normalize_query_inputs(
        query="Calculate zonal statistics for the zones using the DEM.",
        inputs={},
        data_source_ids=[raster["upload_id"], vector["upload_id"]],
        dataset_ids=None,
        datasets=None,
        upload_storage=storage,
    )

    assert normalized.inputs == {
        "vector_ref": vector["upload_id"],
        "raster_ref": raster["upload_id"],
    }
    assert normalized.metadata["request_shape"] == "selected_dataset_mixed_context"
    assert normalized.metadata["bound_dataset_refs"] == {
        "vector": vector["upload_id"],
        "raster": raster["upload_id"],
    }


def test_planning_context_preserves_raster_and_zones_roles() -> None:
    roles = _normalize_input_roles(
        resolved_inputs={},
        user_context={
            "input_roles": {
                "raster": "upl-raster",
                "zones": "upl-zones",
            }
        },
        metadata=None,
    )

    assert roles["raster"]["data_source_id"] == "upl-raster"
    assert roles["zones"]["data_source_id"] == "upl-zones"


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


def test_selected_vector_title_and_stem_are_runtime_aliases() -> None:
    vector = {"type": "FeatureCollection", "features": []}
    runtime_inputs = {"vector": vector}
    final_metadata: dict = {}

    _add_filename_based_runtime_input_aliases(
        runtime_inputs,
        user_context=None,
        metadata={
            "frontend_selected_data_source_titles": [
                "isfahan_subsidence_scenario.geojson"
            ]
        },
        final_metadata=final_metadata,
    )

    assert runtime_inputs["isfahan_subsidence_scenario.geojson"] is vector
    assert runtime_inputs["isfahan_subsidence_scenario"] is vector
    assert final_metadata["runtime_input_aliases_added"][
        "isfahan_subsidence_scenario"
    ] == "vector"


def test_unresolved_explicit_vector_ref_binds_to_sole_runtime_vector() -> None:
    vector = {"type": "FeatureCollection", "features": []}
    runtime_inputs = {"vector": vector}
    final_metadata: dict = {}
    query_spec = SimpleNamespace(
        operations=[
            SimpleNamespace(
                inputs={"vector": "isfahan_subsidence_scenario"},
                output="inspection_results",
            ),
            SimpleNamespace(
                inputs={"vector": "inspection_results"},
                output="report",
            ),
        ]
    )

    _add_single_vector_query_ref_aliases(
        runtime_inputs,
        query_spec=query_spec,
        final_metadata=final_metadata,
    )

    assert runtime_inputs["isfahan_subsidence_scenario"] is vector
    assert "inspection_results" not in runtime_inputs
    assert final_metadata["runtime_input_aliases_added"] == {
        "isfahan_subsidence_scenario": "vector"
    }

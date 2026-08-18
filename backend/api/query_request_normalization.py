"""Public query normalization for selected vector and raster datasets."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from orchestrator.upload_storage import UploadStorage, UploadStorageError
from smart_spatial_system.application.services.vector_query_classifier import (
    is_vector_display_query,
)


_VECTOR_JSON_EXTENSIONS = {".geojson", ".json"}


class QueryRequestNormalizationError(ValueError):
    def __init__(self, *, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.details = details or {}

    def to_public_detail(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": str(self),
            "details": self.details,
        }


@dataclass(frozen=True)
class NormalizedQueryInputs:
    inputs: dict[str, Any]
    metadata: dict[str, Any]


def normalize_query_inputs(
    *,
    query: str,
    inputs: dict[str, Any],
    data_source_ids: list[str] | None,
    dataset_ids: list[str] | None,
    datasets: list[str] | None,
    upload_storage: UploadStorage | None,
) -> NormalizedQueryInputs:
    """Normalize public selected-dataset fields into canonical input references.

    ``inputs.vector_ref`` remains the authoritative legacy binding. The public
    selection fields are interpreted here once, before service dispatch,
    rather than independently in each execution path.
    """
    normalized_inputs = dict(inputs)
    selected_ids = _unique_dataset_ids(data_source_ids, dataset_ids, datasets)
    is_display = is_vector_display_query(query)
    explicit_vector_ref = normalized_inputs.get("vector_ref")

    metadata: dict[str, Any] = {
        "request_shape": "legacy_or_unselected",
        "selected_dataset_ids": selected_ids,
        "normalized_dataset_selection": False,
    }

    if not is_display:
        # QuerySpec analysis needs canonical inputs for every unambiguous
        # selected dataset kind.  The AI workspace sends selected upload IDs,
        # not legacy vector_ref/raster_ref fields.  Resolve one vector and one
        # raster deterministically so mixed workflows can bind roles such as
        # zonal_statistics(raster, zones).
        selected_by_kind: dict[str, list[str]] = {"vector": [], "raster": []}
        if upload_storage is not None:
            for selected_id in selected_ids:
                try:
                    upload_metadata = upload_storage.read_metadata(selected_id)
                except UploadStorageError:
                    continue

                kind = str(upload_metadata.get("kind") or "").strip().lower()
                if kind in selected_by_kind:
                    selected_by_kind[kind].append(selected_id)

        bound_roles: dict[str, str] = {}
        for kind in ("vector", "raster"):
            selected_for_kind = selected_by_kind[kind]
            if len(selected_for_kind) != 1:
                continue

            ref_key = f"{kind}_ref"
            if normalized_inputs.get(ref_key) or normalized_inputs.get(kind):
                continue

            normalized_inputs[ref_key] = selected_for_kind[0]
            bound_roles[kind] = selected_for_kind[0]

        if bound_roles:
            metadata.update(
                {
                    "request_shape": (
                        "selected_dataset_mixed_context"
                        if set(bound_roles) == {"vector", "raster"}
                        else "selected_dataset_analysis_context"
                    ),
                    "bound_dataset_refs": bound_roles,
                    "binding_precedence": (
                        "selected_dataset_kind"
                        if len(bound_roles) > 1
                        else "selected_dataset_id"
                    ),
                    "normalized_dataset_selection": True,
                }
            )
            if "vector" in bound_roles:
                metadata["bound_vector_ref"] = bound_roles["vector"]
            if "raster" in bound_roles:
                metadata["bound_raster_ref"] = bound_roles["raster"]
        return NormalizedQueryInputs(inputs=normalized_inputs, metadata=metadata)

    if isinstance(explicit_vector_ref, str) and explicit_vector_ref.strip():
        vector_ref = explicit_vector_ref.strip()
        _validate_vector_upload(vector_ref, upload_storage)
        metadata.update(
            {
                "request_shape": "inputs.vector_ref",
                "bound_vector_ref": vector_ref,
                "binding_precedence": "explicit_vector_ref",
            }
        )
        return NormalizedQueryInputs(inputs=normalized_inputs, metadata=metadata)

    if not selected_ids:
        raise QueryRequestNormalizationError(
            code="input.dataset_selection_required",
            message="A vector dataset must be selected to display vector features.",
        )

    if len(selected_ids) != 1:
        raise QueryRequestNormalizationError(
            code="input.dataset_selection_ambiguous",
            message="Select exactly one vector dataset to display vector features.",
            details={"selected_dataset_ids": selected_ids},
        )

    vector_ref = selected_ids[0]
    _validate_vector_upload(vector_ref, upload_storage)
    normalized_inputs["vector_ref"] = vector_ref
    metadata.update(
        {
            "request_shape": "selected_dataset_ids",
            "bound_vector_ref": vector_ref,
            "binding_precedence": "selected_dataset_id",
            "normalized_dataset_selection": True,
        }
    )
    return NormalizedQueryInputs(inputs=normalized_inputs, metadata=metadata)


def _unique_dataset_ids(*values: list[str] | None) -> list[str]:
    unique: list[str] = []
    for value in values:
        if value is None:
            continue
        if not isinstance(value, list):
            raise QueryRequestNormalizationError(
                code="input.dataset_selection_invalid",
                message="Dataset selections must be arrays of non-empty IDs.",
            )
        for item in value:
            if not isinstance(item, str) or not item.strip():
                raise QueryRequestNormalizationError(
                    code="input.dataset_selection_invalid",
                    message="Dataset selections must contain non-empty string IDs.",
                )
            dataset_id = item.strip()
            if dataset_id not in unique:
                unique.append(dataset_id)
    return unique


def _validate_vector_upload(upload_id: str, upload_storage: UploadStorage) -> None:
    if upload_storage is None:
        raise QueryRequestNormalizationError(
            code="input.dataset_resolution_unavailable",
            message="Dataset selection cannot be resolved for this request.",
            details={"dataset_id": upload_id},
        )
    try:
        metadata = upload_storage.read_metadata(upload_id)
    except UploadStorageError as exc:
        raise QueryRequestNormalizationError(
            code="input.dataset_not_found",
            message="The selected dataset was not found.",
            details={"dataset_id": upload_id},
        ) from exc

    extension = str(metadata.get("extension") or "").lower()
    if (
        metadata.get("kind") != "vector"
        or extension not in _VECTOR_JSON_EXTENSIONS
        or metadata.get("parsed_json_available") is not True
    ):
        raise QueryRequestNormalizationError(
            code="input.dataset_not_displayable_vector",
            message="The selected dataset is not a valid GeoJSON vector dataset.",
            details={"dataset_id": upload_id},
        )

from __future__ import annotations

from collections.abc import Callable
from typing import Any


def _as_mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _coerce_data_source_ref(value: Any) -> dict[str, Any] | None:
    """
    Normalize a role value into a data-source reference.

    Supported forms:
      "upl-..." ->
          {"data_source_id": "upl-..."}
      {"data_source_id": "...", ...} ->
          same dict
      {"source_id": "...", ...} ->
          converted with data_source_id fallback
    """
    if value is None:
        return None

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        return {
            "data_source_id": text,
            "source_id": text,
        }

    if isinstance(value, dict):
        payload = dict(value)
        data_source_id = (
            payload.get("data_source_id")
            or payload.get("source_id")
            or payload.get("dataset_id")
            or payload.get("upload_id")
            or payload.get("id")
        )
        if not data_source_id:
            return None

        payload["data_source_id"] = str(data_source_id)
        payload.setdefault("source_id", str(data_source_id))
        return payload

    return None


def _merge_ref(base: dict[str, Any] | None, extra: dict[str, Any] | None) -> dict[str, Any] | None:
    if not base and not extra:
        return None
    merged: dict[str, Any] = {}
    if base:
        merged.update(base)
    if extra:
        # Do not overwrite a stronger data_source_id with empty values.
        for key, value in extra.items():
            if value is not None and value != "":
                merged[key] = value

    data_source_id = (
        merged.get("data_source_id")
        or merged.get("source_id")
        or merged.get("dataset_id")
        or merged.get("upload_id")
        or merged.get("id")
    )
    if not data_source_id:
        return None

    merged["data_source_id"] = str(data_source_id)
    merged.setdefault("source_id", str(data_source_id))
    return merged


def _collect_context_data_sources(
    *,
    user_context: dict[str, Any] | None,
    metadata: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    context = _as_mapping(user_context)
    meta = _as_mapping(metadata)

    candidates: list[Any] = []

    for container in (context, meta):
        value = container.get("data_sources")
        if isinstance(value, list):
            candidates.extend(value)

        value = container.get("selected_data_sources")
        if isinstance(value, list):
            candidates.extend(value)

    normalized: list[dict[str, Any]] = []
    for item in candidates:
        if isinstance(item, dict):
            ref = _coerce_data_source_ref(item)
            if ref:
                normalized.append(ref)

    return normalized


def _normalize_input_roles(
    *,
    resolved_inputs: dict[str, Any],
    user_context: dict[str, Any] | None,
    metadata: dict[str, Any] | None,
) -> dict[str, dict[str, Any]]:
    """
    Resolve source/target role bindings for nearest/proximity operations.

    Reads all supported frontend/backend contract locations:
      - inputs.source / inputs.target                -> resolved_inputs
      - context.input_roles.source / target          -> user_context
      - context.role_bindings.source / target        -> user_context
      - context.data_sources[].role/input_role       -> user_context
      - metadata.input_roles / metadata.role_bindings
    """
    resolved_inputs = _as_mapping(resolved_inputs)
    context = _as_mapping(user_context)
    meta = _as_mapping(metadata)

    roles: dict[str, dict[str, Any]] = {}

    def set_role(role: str, value: Any, *, extra: dict[str, Any] | None = None) -> None:
        if role not in {"source", "target"}:
            return

        ref = _coerce_data_source_ref(value)
        if not ref and extra:
            ref = _coerce_data_source_ref(extra)

        merged = _merge_ref(roles.get(role), _merge_ref(ref, extra))
        if merged:
            merged["role"] = role
            merged["input_role"] = role
            roles[role] = merged

    # 1) Direct inputs.source / inputs.target.
    set_role("source", resolved_inputs.get("source"))
    set_role("target", resolved_inputs.get("target"))

    # 2) context.input_roles / metadata.input_roles.
    for container in (context, meta):
        input_roles = _as_mapping(container.get("input_roles"))
        set_role("source", input_roles.get("source"))
        set_role("target", input_roles.get("target"))

    # 3) context.role_bindings / metadata.role_bindings.
    for container in (context, meta):
        role_bindings = _as_mapping(container.get("role_bindings"))
        set_role("source", role_bindings.get("source"))
        set_role("target", role_bindings.get("target"))

    # 4) context.data_sources[].role/input_role.
    for ds in _collect_context_data_sources(user_context=user_context, metadata=metadata):
        role = str(ds.get("input_role") or ds.get("role") or "").strip().lower()
        if role in {"source", "target"}:
            set_role(role, ds, extra=ds)

    return roles


def build_query_spec_planning_context(
    *,
    query: str,
    resolved_inputs: dict[str, Any],
    user_context: dict[str, Any] | None,
    metadata: dict[str, Any] | None,
    project_id: str | None,
    response_language: Any,
    extract_semantic_planning_context: Callable[..., tuple[Any, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    semantic_planning_context, semantic_planning_context_error = (
        extract_semantic_planning_context(
            query=query,
            resolved_inputs=resolved_inputs,
            user_context=user_context,
            metadata=metadata,
        )
    )

    resolved_input_roles = _normalize_input_roles(
        resolved_inputs=resolved_inputs or {},
        user_context=user_context,
        metadata=metadata,
    )

    planning_context: dict[str, Any] = {
        "available_inputs": sorted((resolved_inputs or {}).keys()),
        "response_language": response_language,
        "project_id": project_id,

        # Role-aware planning contract for nearest/proximity operations.
        "input_roles": {
            role: ref.get("data_source_id")
            for role, ref in resolved_input_roles.items()
            if ref.get("data_source_id")
        },
        "role_bindings": resolved_input_roles,
        "resolved_input_roles": resolved_input_roles,

        "query_spec_contracts": {
            "query_database": {
                "contract": "query_database.postgis.v1",
                "required_format": {
                    "source_type": "postgis",
                    "mode": "select_table",
                    "schema": "public",
                    "table": "table_name_without_schema",
                    "columns": ["property_column_1", "property_column_2"],
                    "geom_col": "real_geometry_column",
                    "geom_alias": "geom",
                    "where": "optional safe where clause",
                    "limit": 1000,
                    "output_srid": 4326,
                },
                "rules": [
                    "Do not use sql.",
                    "Do not use select.",
                    "Do not use fields.",
                    "Do not use projection.",
                    "Do not invent parameter names.",
                    "columns must contain only property column names.",
                    "Do not put geometry expressions like 'way AS geom' in columns.",
                    "Use geom_col for the real geometry column and geom_alias for the output geometry alias.",
                ],
                "valid_example": {
                    "op": "query_database",
                    "inputs": {},
                    "params": {
                        "source_type": "postgis",
                        "mode": "select_table",
                        "schema": "public",
                        "table": "osm_tehran_parks",
                        "columns": ["osm_id", "name"],
                        "geom_col": "way",
                        "geom_alias": "geom",
                        "where": "way IS NOT NULL",
                        "limit": 10,
                        "output_srid": 4326,
                    },
                    "output": "parks_layer",
                },
            },
            "spatial_nearest": {
                "contract": "spatial_nearest.vector.v1",
                "required_inputs": ["source", "target"],
                "rules": [
                    "For nearest/proximity analysis, always bind source and target input roles.",
                    "source is the feature layer to rank or annotate.",
                    "target is the reference feature layer to measure distance to.",
                    "Use input role names exactly: source and target.",
                    "Do not use raster, NDVI, spectral index, thresholding, or raster-to-vector for vector-only nearest/proximity queries.",
                ],
                "valid_example": {
                    "op": "spatial_nearest",
                    "inputs": {
                        "source": "source",
                        "target": "target",
                    },
                    "params": {
                        "k": 1,
                    },
                    "output": "nearest_results",
                },
            },
        },
    }

    metadata_updates: dict[str, Any] = {
        "resolved_input_roles": resolved_input_roles,
    }

    if resolved_input_roles:
        metadata_updates["resolved_input_role_names"] = sorted(resolved_input_roles.keys())

    if semantic_planning_context is not None:
        planning_context["semantic_planning_context"] = semantic_planning_context
        metadata_updates["semantic_planning_context_attached"] = True

    if semantic_planning_context_error:
        metadata_updates["semantic_planning_context_error"] = semantic_planning_context_error

    return planning_context, metadata_updates

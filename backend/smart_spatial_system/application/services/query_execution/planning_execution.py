from __future__ import annotations

import re
from pathlib import Path
from collections.abc import Callable
from typing import Any


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _alias_candidates_from_title(title: Any) -> list[str]:
    """
    Build safe runtime input aliases from a data source title/filename.

    Example:
      austria_candidate_areas.geojson
      -> austria_candidate_areas.geojson
      -> austria_candidate_areas

    LLMs often use filename stems as QuerySpec entity refs. The execution
    runtime, however, usually has role keys such as source/target. These
    aliases make both forms resolvable.
    """
    if not isinstance(title, str) or not title.strip():
        return []

    raw = title.strip()
    stem = Path(raw).stem

    candidates: list[str] = []

    for value in (raw, stem):
        if not value:
            continue

        candidates.append(value)

        normalized = re.sub(r"[^0-9A-Za-z_]+", "_", value).strip("_")
        if normalized:
            candidates.append(normalized)

    # Stable de-dup preserving order.
    return list(dict.fromkeys(candidates))


def _iter_data_sources(
    *,
    user_context: dict[str, Any] | None,
    metadata: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []

    for container in (_as_dict(user_context), _as_dict(metadata)):
        value = container.get("data_sources")
        if isinstance(value, list):
            sources.extend(item for item in value if isinstance(item, dict))

        # Some callers may nest the original frontend context under "context".
        nested_context = container.get("context")
        if isinstance(nested_context, dict):
            nested_sources = nested_context.get("data_sources")
            if isinstance(nested_sources, list):
                sources.extend(item for item in nested_sources if isinstance(item, dict))

    return sources


def _add_filename_based_runtime_input_aliases(
    runtime_inputs: dict[str, Any],
    *,
    user_context: dict[str, Any] | None,
    metadata: dict[str, Any] | None,
    final_metadata: dict[str, Any],
) -> None:
    """
    Add aliases like:
      runtime_inputs["austria_candidate_areas"] = runtime_inputs["source"]

    This protects DAG execution when an LLM uses file/layer names as QuerySpec
    entity refs instead of the canonical role names source/target.
    """
    aliases_added: dict[str, str] = {}

    # 1) Use context.data_sources entries. This is the strongest signal because
    # each source usually carries role/input_role and title.
    for data_source in _iter_data_sources(
        user_context=user_context,
        metadata=metadata,
    ):
        role = (
            data_source.get("input_role")
            or data_source.get("role")
            or data_source.get("logical_role")
        )
        if not isinstance(role, str) or role not in runtime_inputs:
            continue

        role_value = runtime_inputs.get(role)

        for title_key in ("title", "name", "filename", "file_name", "layer_name"):
            for alias in _alias_candidates_from_title(data_source.get(title_key)):
                if alias and alias not in runtime_inputs:
                    runtime_inputs[alias] = role_value
                    aliases_added[alias] = role

    # 2) Use metadata.frontend_input_roles as a fallback/additional signal:
    #    {"source": {"id": "...", "title": "austria_candidate_areas.geojson"}}
    frontend_roles = _as_dict(_as_dict(metadata).get("frontend_input_roles"))
    for role, role_info in frontend_roles.items():
        if not isinstance(role, str) or role not in runtime_inputs:
            continue

        role_value = runtime_inputs.get(role)
        role_info_dict = _as_dict(role_info)

        for title_key in ("title", "name", "filename", "file_name", "layer_name"):
            for alias in _alias_candidates_from_title(role_info_dict.get(title_key)):
                if alias and alias not in runtime_inputs:
                    runtime_inputs[alias] = role_value
                    aliases_added[alias] = role

    if aliases_added:
        final_metadata["runtime_input_aliases_added"] = aliases_added
        final_metadata["runtime_input_alias_names"] = sorted(aliases_added.keys())



def execute_query_spec_planning(
    *,
    query: str,
    planning_context: dict[str, Any],
    resolved_inputs: dict[str, Any],
    user_context: dict[str, Any] | None,
    metadata: dict[str, Any] | None,
    final_metadata: dict[str, Any],
    build_runtime_inputs: Callable[..., tuple[dict[str, Any], bool]],
    enrich_query_database_params: Callable[[Any, dict[str, Any]], Any],
    build_enabled_registry_view: Callable[[], Any],
    kernel_execution_enabled: Callable[..., bool],
    llm_client_factory: Callable[[], Any],
    query_spec_generator_cls: Callable[[Any], Any],
    planning_runner_factory: Callable[[Any], Any],
    query_spec_contract_validator: Callable[[Any], Any],
) -> tuple[Any, Any, bool]:
    llm_client = llm_client_factory()
    generator = query_spec_generator_cls(llm_client)

    query_spec = generator.generate(
        query,
        context=planning_context,
    )

    planning_runtime_inputs, postgis_runtime_connection_injected = (
        build_runtime_inputs(
            resolved_inputs=resolved_inputs,
            user_context=user_context,
            metadata=metadata,
        )
    )

    _add_filename_based_runtime_input_aliases(
        planning_runtime_inputs,
        user_context=user_context,
        metadata=metadata,
        final_metadata=final_metadata,
    )

    if postgis_runtime_connection_injected:
        final_metadata["postgis_runtime_connection_injected"] = True

    enrich_query_database_params(
        query_spec,
        planning_runtime_inputs,
    )

    query_spec_contract_validator(query_spec)

    runner = planning_runner_factory(build_enabled_registry_view())

    kernel_enabled = kernel_execution_enabled(
        metadata=metadata,
        final_metadata=final_metadata,
    )
    final_metadata["kernel_execution_enabled"] = kernel_enabled

    if kernel_enabled:
        planning_result = runner.run_with_kernel_execution(
            query_spec,
            initial_inputs=planning_runtime_inputs,
            fail_fast=True,
        )
    else:
        planning_result = runner.run(
            query_spec,
            initial_inputs=planning_runtime_inputs,
            fail_fast=True,
        )

    return query_spec, planning_result, kernel_enabled

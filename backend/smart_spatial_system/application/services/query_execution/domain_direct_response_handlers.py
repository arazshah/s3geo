"""
Domain direct-response handlers for query execution.

This module is a temporary compatibility boundary for domain-specific direct
responses. QueryExecutionService injects these handlers generically into the
dispatch layer and does not expose domain-specific helper methods itself.

Preferred path:
    Resolve domain direct-response handlers through plugin/capability bridge
    capabilities.

Fallback path:
    Lazy-load the legacy application query_execution domain modules for
    compatibility.

Important: this module must not import QueryExecutionService to avoid circular
imports during application/test collection.
"""

from __future__ import annotations

import importlib
from functools import lru_cache
from typing import Any, Callable


_QUERY_EXECUTION_DOMAIN_MODULE_PREFIX = (
    "smart_spatial_system.application.services.query_execution"
)

_BRIDGE_PLUGIN_MODULE = "plugins.real_estate_ranking_bridge"
_BRIDGE_MISSING_INPUTS_CAPABILITY = "try_handle_missing_real_estate_inputs"
_BRIDGE_RANKING_CAPABILITY = "try_handle_real_estate_ranking_directly"


def _query_execution_domain_callable(module_name: str, callable_name: str):
    module = importlib.import_module(
        f"{_QUERY_EXECUTION_DOMAIN_MODULE_PREFIX}.{module_name}"
    )
    return getattr(module, callable_name)


@lru_cache(maxsize=1)
def _domain_bridge_registry():
    """
    Build a tiny registry for domain bridge capabilities.

    Keep this lazy and scoped to the bridge plugin only. Loading the complete
    default plugin registry here would make every direct-response preflight pay
    the cost of importing all plugins and would also blur the boundary this
    module is meant to enforce.
    """
    from orchestrator.capability_registry import CapabilityRegistry

    return CapabilityRegistry.from_plugin_modules(
        [_BRIDGE_PLUGIN_MODULE],
        tolerant=True,
    )


def _capability_bridge_callable(capability_name: str):
    """
    Resolve a domain direct-response callable through the capability boundary.

    Returns None when the bridge plugin is unavailable, disabled by environment
    constraints, or does not expose the requested capability. Callers then use
    the legacy lazy application-module fallback.
    """
    try:
        binding = _domain_bridge_registry().resolve(capability_name)
    except Exception:
        return None

    candidate = getattr(binding, "callable", None)
    if not callable(candidate):
        return None

    return candidate


def handle_default_preflight_direct_response(
    *,
    query: str,
    inputs: dict[str, Any],
    resolved_inputs: dict[str, Any],
    final_request_id: str,
    final_metadata: dict[str, Any],
    remember: Callable[..., Any],
    attach_request: Callable[..., Any],
    json_safe: Callable[[Any], Any],
    band_map: dict[str, int] | None = None,
    user_context: dict[str, Any] | None = None,
    llm_intent: Any | None = None,
) -> dict[str, Any] | None:
    handler = _capability_bridge_callable(_BRIDGE_MISSING_INPUTS_CAPABILITY)

    if handler is None:
        handler = _query_execution_domain_callable(
            "real_estate_missing_inputs",
            "try_handle_missing_real_estate_inputs",
        )

    return handler(
        query=query,
        inputs=inputs,
        resolved_inputs=resolved_inputs,
        final_request_id=final_request_id,
        final_metadata=final_metadata,
        band_map=band_map,
        user_context=user_context,
        llm_intent=llm_intent,
        remember=remember,
        attach_request=attach_request,
        json_safe=json_safe,
    )


def handle_default_direct_response(
    *,
    query: str,
    inputs: dict[str, Any] | None,
    llm_planning_enabled: Callable[[], bool],
    request_id: str | None = None,
    llm_intent: Any = None,
    reports_path: str | None = None,
) -> dict[str, Any] | None:
    handler = _capability_bridge_callable(_BRIDGE_RANKING_CAPABILITY)

    if handler is None:
        handler = _query_execution_domain_callable(
            "real_estate_ranking_direct_handler",
            "try_handle_real_estate_ranking_directly",
        )

    return handler(
        query=query,
        inputs=inputs,
        request_id=request_id,
        llm_intent=llm_intent,
        llm_planning_enabled=llm_planning_enabled,
        reports_path=reports_path,
    )

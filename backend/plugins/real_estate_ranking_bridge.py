"""
real_estate_ranking_bridge.py

Bridge plugin for real-estate ranking direct-response compatibility.

This plugin intentionally keeps the implementation behind lazy imports so the
plugin registry can expose real-estate direct-response capabilities without
forcing application domain modules to be imported at plugin discovery time.

Long-term direction:
    QueryExecutionService / direct dispatch should resolve these capabilities
    through the capability registry instead of importing application domain
    handlers directly.
"""

from __future__ import annotations

import importlib
from typing import Any

from geochat_sdk.decorators import capability
from geochat_sdk.plugin import auto_collect


PLUGIN_ID = "real_estate_ranking_bridge"


def _query_execution_domain_callable(module_name: str, callable_name: str):
    module = importlib.import_module(
        f"smart_spatial_system.application.services.query_execution.{module_name}"
    )
    return getattr(module, callable_name)


@capability(
    name="try_handle_missing_real_estate_inputs",
    description=(
        "Compatibility bridge for controlled real-estate missing-input responses."
    ),
    required_inputs=[],
    optional_inputs=[
        "context",
        "query",
        "inputs",
        "resolved_inputs",
        "final_request_id",
        "final_metadata",
        "json_safe",
        "llm_intent",
        "remember",
    ],
    output_kind="json",
    keywords=[],
    permissions=[],
    metadata={
        "category": "domain_bridge",
        "domain": "real_estate",
        "operation": "missing_inputs_direct_response",
        "module_name": "plugins.real_estate_ranking_bridge",
        "bridge_target_module": (
            "smart_spatial_system.application.services.query_execution."
            "real_estate_missing_inputs"
        ),
        "direct_dispatch_only": True,
        "keyword_routable": False,
        "compatibility_bridge": True,
    },
)
def try_handle_missing_real_estate_inputs(
    *args: Any,
    **kwargs: Any,
) -> dict[str, Any] | None:
    handler = _query_execution_domain_callable(
        "real_estate_missing_inputs",
        "try_handle_missing_real_estate_inputs",
    )
    return handler(*args, **kwargs)


@capability(
    name="try_handle_real_estate_ranking_directly",
    description=(
        "Compatibility bridge for real-estate ranking/report direct responses."
    ),
    required_inputs=[],
    optional_inputs=[
        "context",
        "query",
        "inputs",
        "resolved_inputs",
        "final_request_id",
        "final_metadata",
        "json_safe",
        "band_map",
        "user_context",
        "llm_intent",
        "remember",
    ],
    output_kind="json",
    keywords=[],
    permissions=[],
    metadata={
        "category": "domain_bridge",
        "domain": "real_estate",
        "operation": "ranking_direct_response",
        "module_name": "plugins.real_estate_ranking_bridge",
        "bridge_target_module": (
            "smart_spatial_system.application.services.query_execution."
            "real_estate_ranking_direct_handler"
        ),
        "direct_dispatch_only": True,
        "keyword_routable": False,
        "compatibility_bridge": True,
    },
)
def try_handle_real_estate_ranking_directly(
    *args: Any,
    **kwargs: Any,
) -> dict[str, Any] | None:
    handler = _query_execution_domain_callable(
        "real_estate_ranking_direct_handler",
        "try_handle_real_estate_ranking_directly",
    )
    return handler(*args, **kwargs)


PLUGIN = auto_collect(
    id=PLUGIN_ID,
    version="1.0.0",
    name="Real Estate Ranking Bridge",
    description=(
        "Compatibility bridge exposing real-estate ranking direct-response "
        "handlers through the plugin/capability registry."
    ),
    author="GeoChat Platform Team",
    permissions=[],
)

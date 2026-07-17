"""
Domain method boundary regression tests for QueryExecutionService.

QueryExecutionService is generic orchestration/application plumbing. It must
not expose real_estate-specific compatibility methods on its class surface.
Domain-specific direct behavior should be injected through generic dispatch
handlers.
"""

from __future__ import annotations

import ast
from pathlib import Path


SERVICE_PATH = Path("smart_spatial_system/application/services/query_execution_service.py")


def test_query_execution_service_does_not_expose_real_estate_methods() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(SERVICE_PATH))

    offenders: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "QueryExecutionService":
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and "real_estate" in item.name:
                    offenders.append(item.name)

    assert offenders == []


def test_query_execution_service_injects_generic_direct_response_handlers() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")

    assert "preflight_direct_response_handler=" in source
    assert "direct_response_handler=" in source
    assert "handle_default_preflight_direct_response(" in source
    assert "handle_default_direct_response(" in source
    assert "self._try_handle_missing_real_estate_inputs" not in source
    assert "self._try_handle_real_estate_ranking_directly" not in source

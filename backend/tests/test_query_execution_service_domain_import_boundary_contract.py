"""
Domain import boundary regression tests for QueryExecutionService.

QueryExecutionService must not top-level import real_estate query execution
modules and must not own domain lazy-loading helpers. Domain-specific behavior
is loaded lazily behind query_execution adapter boundaries.
"""

from __future__ import annotations

import ast
from pathlib import Path


SERVICE_PATH = Path("smart_spatial_system/application/services/query_execution_service.py")
DIRECT_HANDLER_PATH = Path(
    "smart_spatial_system/application/services/query_execution/domain_direct_response_handlers.py"
)


def test_query_execution_service_does_not_top_level_import_real_estate_query_modules() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(SERVICE_PATH))

    offenders: list[str] = []

    for node in tree.body:
        if isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if "real_estate" in module:
                offenders.append(module)

    assert offenders == []


def test_query_execution_service_does_not_own_query_execution_domain_callable_boundary() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")

    assert "def _query_execution_domain_callable(" not in source
    assert "_query_execution_domain_callable(" not in source


def test_domain_direct_response_handlers_own_lazy_query_execution_domain_boundary() -> None:
    source = DIRECT_HANDLER_PATH.read_text(encoding="utf-8")

    assert "def _query_execution_domain_callable(" in source
    assert "importlib.import_module(" in source
    assert "real_estate_missing_inputs" in source
    assert "real_estate_ranking_direct_handler" in source

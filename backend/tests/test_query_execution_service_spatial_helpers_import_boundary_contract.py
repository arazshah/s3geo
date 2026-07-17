"""
Domain import boundary regression tests for QueryExecutionService.

QueryExecutionService must not top-level import real_estate application helper
modules and must not own application-service domain lazy-loading helpers.
Domain-specific spatial helpers live behind the property spatial adapter
compatibility boundary.
"""

from __future__ import annotations

import ast
from pathlib import Path


SERVICE_PATH = Path("smart_spatial_system/application/services/query_execution_service.py")
PROPERTY_SPATIAL_ADAPTER_PATH = Path(
    "smart_spatial_system/application/services/query_execution/property_spatial_context_adapter.py"
)


def test_query_execution_service_does_not_top_level_import_real_estate_spatial_helpers() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(SERVICE_PATH))

    offenders: list[str] = []

    for node in tree.body:
        if isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if module == "smart_spatial_system.application.services.real_estate_spatial_helpers":
                offenders.append(module)

    assert offenders == []


def test_query_execution_service_does_not_own_application_service_domain_callable_boundary() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")

    assert "def _application_service_domain_callable(" not in source
    assert "_application_service_domain_callable(" not in source


def test_property_spatial_adapter_owns_lazy_application_service_domain_boundary() -> None:
    source = PROPERTY_SPATIAL_ADAPTER_PATH.read_text(encoding="utf-8")

    assert "def _application_service_domain_callable(" in source
    assert "importlib.import_module(" in source
    assert "real_estate_spatial_helpers" in source

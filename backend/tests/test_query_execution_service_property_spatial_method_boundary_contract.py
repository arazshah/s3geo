"""
Property/spatial method boundary regression tests for QueryExecutionService.

QueryExecutionService must not expose property/domain-specific spatial helper
wrappers on its class surface and must not import the property spatial adapter
unless it actually participates in query orchestration. Compatibility helpers
live in the query_execution property_spatial_context_adapter module.
"""

from __future__ import annotations

import ast
from pathlib import Path


SERVICE_PATH = Path("smart_spatial_system/application/services/query_execution_service.py")
PROPERTY_SPATIAL_ADAPTER_PATH = Path(
    "smart_spatial_system/application/services/query_execution/property_spatial_context_adapter.py"
)


PROPERTY_SPATIAL_METHODS = {
    "_extract_property_feature_collection_from_inputs",
    "_feature_point_lonlat",
    "_point_in_ring_lonlat",
    "_point_in_polygon_feature_lonlat",
    "_lonlat_to_local_xy_m",
    "_distance_point_to_segment_m",
    "_distance_point_to_point_m",
    "_distance_point_to_geometry_m",
    "_nearest_distance_to_features_m",
    "_has_metric_value",
    "_has_bool_like_value",
    "_normalize_risk_level",
    "_to_float_or_none",
    "_enrich_property_feature_collection_with_spatial_context",
}


def test_query_execution_service_does_not_expose_property_spatial_methods() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(SERVICE_PATH))

    offenders: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef) and node.name == "QueryExecutionService":
            for item in node.body:
                if isinstance(item, ast.FunctionDef) and item.name in PROPERTY_SPATIAL_METHODS:
                    offenders.append(item.name)

    assert offenders == []


def test_query_execution_service_does_not_import_property_spatial_adapter_boundary() -> None:
    source = SERVICE_PATH.read_text(encoding="utf-8")

    assert "property_spatial_context_adapter" not in source
    assert "extract_default_property_feature_collection_from_inputs" not in source
    assert "enrich_default_property_feature_collection_with_spatial_context" not in source


def test_property_spatial_adapter_exposes_compatibility_boundary() -> None:
    source = PROPERTY_SPATIAL_ADAPTER_PATH.read_text(encoding="utf-8")

    assert "def extract_default_property_feature_collection_from_inputs(" in source
    assert "def enrich_default_property_feature_collection_with_spatial_context(" in source
    assert "def _application_service_domain_callable(" in source

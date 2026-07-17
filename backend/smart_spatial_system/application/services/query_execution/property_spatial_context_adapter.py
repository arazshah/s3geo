"""
Property spatial context adapter for query execution.

This module keeps property/spatial compatibility helpers outside
QueryExecutionService. The service should remain generic orchestration plumbing
and must not expose property/domain-specific helper methods on its class surface.
"""

from __future__ import annotations

import importlib
from typing import Any

from smart_spatial_system.application.services.query_execution.real_estate_context import (
    enrich_property_feature_collection_with_spatial_context,
    extract_property_feature_collection_from_inputs,
)


_APPLICATION_SERVICE_DOMAIN_MODULE_PREFIX = "smart_spatial_system.application.services"


def _application_service_domain_callable(module_name: str, callable_name: str):
    module = importlib.import_module(
        f"{_APPLICATION_SERVICE_DOMAIN_MODULE_PREFIX}.{module_name}"
    )
    return getattr(module, callable_name)


def extract_default_property_feature_collection_from_inputs(
    inputs: dict[str, Any] | None,
) -> dict[str, Any] | None:
    return extract_property_feature_collection_from_inputs(inputs)


def feature_point_lonlat(feature: dict[str, Any]) -> tuple[float, float] | None:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "feature_point_lonlat",
    )(feature)


def point_in_ring_lonlat(point: tuple[float, float], ring: list[Any]) -> bool:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "point_in_ring_lonlat",
    )(point, ring)


def point_in_polygon_feature_lonlat(
    point: tuple[float, float],
    feature: dict[str, Any],
) -> bool:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "point_in_polygon_feature_lonlat",
    )(point, feature)


def lonlat_to_local_xy_m(
    point: tuple[float, float],
    *,
    ref_lat: float,
) -> tuple[float, float]:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "lonlat_to_local_xy_m",
    )(point, ref_lat=ref_lat)


def distance_point_to_segment_m(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "distance_point_to_segment_m",
    )(point, start, end)


def distance_point_to_point_m(
    a: tuple[float, float],
    b: tuple[float, float],
) -> float:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "distance_point_to_point_m",
    )(a, b)


def distance_point_to_geometry_m(
    point: tuple[float, float],
    feature: dict[str, Any],
) -> float | None:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "distance_point_to_geometry_m",
    )(point, feature)


def nearest_distance_to_features_m(
    point: tuple[float, float],
    features: list[dict[str, Any]],
) -> float | None:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "nearest_distance_to_features_m",
    )(point, features)


def has_metric_value(props: dict[str, Any], key: str) -> bool:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "has_metric_value",
    )(props, key)


def has_bool_like_value(props: dict[str, Any], *keys: str) -> bool:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "has_bool_like_value",
    )(props, *keys)


def normalize_risk_level(value: Any) -> str:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "normalize_risk_level",
    )(value)


def to_float_or_none(value: Any) -> float | None:
    return _application_service_domain_callable(
        "real_estate_spatial_helpers",
        "to_float_or_none",
    )(value)


def enrich_default_property_feature_collection_with_spatial_context(
    feature_collection: dict[str, Any],
    spatial_context: dict[str, list[dict[str, Any]]] | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    return enrich_property_feature_collection_with_spatial_context(
        feature_collection,
        spatial_context,
        feature_point_lonlat=feature_point_lonlat,
        has_metric_value=has_metric_value,
        nearest_distance_to_features_m=nearest_distance_to_features_m,
        has_bool_like_value=has_bool_like_value,
        point_in_polygon_feature_lonlat=point_in_polygon_feature_lonlat,
    )

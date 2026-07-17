"""
Vector display handler domain import boundary regression tests.

vector_display_handler is generic vector-output plumbing. It may protect
domain-specific direct handlers from being swallowed, but it must not top-level
import real_estate modules.
"""

from __future__ import annotations

import ast
from pathlib import Path


HANDLER_PATH = Path("smart_spatial_system/application/services/vector_display_handler.py")


def test_vector_display_handler_does_not_top_level_import_real_estate_modules() -> None:
    source = HANDLER_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(HANDLER_PATH))

    offenders: list[str] = []

    for node in tree.body:
        if isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if "real_estate" in module:
                offenders.append(module)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if "real_estate" in alias.name:
                    offenders.append(alias.name)

    assert offenders == []


def test_vector_display_handler_lazy_loads_real_estate_classifier_boundary() -> None:
    source = HANDLER_PATH.read_text(encoding="utf-8")

    assert "importlib.import_module(" in source
    assert "real_estate_classifier" in source
    assert (
        "from smart_spatial_system.application.services.query_execution.real_estate_classifier import"
        not in source
    )


def test_vector_display_guard_does_not_treat_generic_property_words_as_ranking_terms() -> None:
    source = HANDLER_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(HANDLER_PATH))

    ranking_terms: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            if any(
                isinstance(target, ast.Name)
                and target.id == "real_estate_ranking_terms"
                for target in node.targets
            ):
                if isinstance(node.value, ast.Tuple):
                    for item in node.value.elts:
                        if isinstance(item, ast.Constant) and isinstance(item.value, str):
                            ranking_terms.add(item.value)

    assert ranking_terms >= {
        "امتیاز",
        "رتبه",
        "رتبه‌بندی",
        "رتبه بندی",
        "گزارش",
        "pdf",
        "پی دی اف",
        "جدول",
    }

    assert "ملک" not in ranking_terms
    assert "املاک" not in ranking_terms

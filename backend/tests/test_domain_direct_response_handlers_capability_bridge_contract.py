"""
Domain direct-response handler capability bridge contract tests.

The generic domain_direct_response_handlers module may keep legacy lazy
application fallbacks, but its preferred path must resolve real-estate direct
responses through the plugin/capability bridge.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any

from smart_spatial_system.application.services.query_execution import (
    domain_direct_response_handlers as handlers,
)


HANDLER_PATH = Path(
    "smart_spatial_system/application/services/query_execution/"
    "domain_direct_response_handlers.py"
)


def test_domain_direct_response_handlers_do_not_top_level_import_real_estate_modules() -> None:
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


def test_default_preflight_direct_response_prefers_capability_bridge(monkeypatch) -> None:
    calls: list[dict[str, Any]] = []

    def fake_bridge_callable(capability_name: str):
        assert capability_name == "try_handle_missing_real_estate_inputs"

        def fake_handler(**kwargs: Any) -> dict[str, Any]:
            calls.append(kwargs)
            return {
                "ok": False,
                "source": "capability_bridge",
                "type": "missing_inputs",
            }

        return fake_handler

    def fail_legacy_import(*args: Any, **kwargs: Any):
        raise AssertionError("legacy lazy import fallback must not be used")

    monkeypatch.setattr(handlers, "_capability_bridge_callable", fake_bridge_callable)
    monkeypatch.setattr(handlers, "_query_execution_domain_callable", fail_legacy_import)

    result = handlers.handle_default_preflight_direct_response(
        query="q",
        inputs={},
        resolved_inputs={},
        final_request_id="req-bridge-preflight",
        final_metadata={"m": 1},
        remember=lambda **kwargs: None,
        attach_request=lambda response: response,
        json_safe=lambda value: value,
        band_map=None,
        user_context=None,
        llm_intent=None,
    )

    assert result == {
        "ok": False,
        "source": "capability_bridge",
        "type": "missing_inputs",
    }
    assert calls
    assert calls[0]["query"] == "q"
    assert calls[0]["final_request_id"] == "req-bridge-preflight"


def test_default_direct_response_prefers_capability_bridge(monkeypatch) -> None:
    calls: list[dict[str, Any]] = []

    def fake_bridge_callable(capability_name: str):
        assert capability_name == "try_handle_real_estate_ranking_directly"

        def fake_handler(**kwargs: Any) -> dict[str, Any]:
            calls.append(kwargs)
            return {
                "ok": True,
                "source": "capability_bridge",
                "type": "real_estate_ranking",
            }

        return fake_handler

    def fail_legacy_import(*args: Any, **kwargs: Any):
        raise AssertionError("legacy lazy import fallback must not be used")

    monkeypatch.setattr(handlers, "_capability_bridge_callable", fake_bridge_callable)
    monkeypatch.setattr(handlers, "_query_execution_domain_callable", fail_legacy_import)

    result = handlers.handle_default_direct_response(
        query="q",
        inputs={"features": []},
        request_id="req-bridge-ranking",
        llm_intent={"intent_name": "real_estate_ranking"},
        llm_planning_enabled=lambda: False,
    )

    assert result == {
        "ok": True,
        "source": "capability_bridge",
        "type": "real_estate_ranking",
    }
    assert calls
    assert calls[0]["query"] == "q"
    assert calls[0]["request_id"] == "req-bridge-ranking"


def test_default_preflight_direct_response_falls_back_to_legacy_lazy_handler(monkeypatch) -> None:
    calls: list[tuple[str, str, dict[str, Any]]] = []

    def no_bridge_callable(capability_name: str):
        return None

    def fake_legacy_import(module_name: str, callable_name: str):
        assert module_name == "real_estate_missing_inputs"
        assert callable_name == "try_handle_missing_real_estate_inputs"

        def fake_handler(**kwargs: Any) -> dict[str, Any]:
            calls.append((module_name, callable_name, kwargs))
            return {
                "ok": False,
                "source": "legacy_lazy_fallback",
                "type": "missing_inputs",
            }

        return fake_handler

    monkeypatch.setattr(handlers, "_capability_bridge_callable", no_bridge_callable)
    monkeypatch.setattr(handlers, "_query_execution_domain_callable", fake_legacy_import)

    result = handlers.handle_default_preflight_direct_response(
        query="q",
        inputs={},
        resolved_inputs={},
        final_request_id="req-fallback-preflight",
        final_metadata={},
        remember=lambda **kwargs: None,
        attach_request=lambda response: response,
        json_safe=lambda value: value,
    )

    assert result == {
        "ok": False,
        "source": "legacy_lazy_fallback",
        "type": "missing_inputs",
    }
    assert calls
    assert calls[0][2]["final_request_id"] == "req-fallback-preflight"


def test_default_direct_response_falls_back_to_legacy_lazy_handler(monkeypatch) -> None:
    calls: list[tuple[str, str, dict[str, Any]]] = []

    def no_bridge_callable(capability_name: str):
        return None

    def fake_legacy_import(module_name: str, callable_name: str):
        assert module_name == "real_estate_ranking_direct_handler"
        assert callable_name == "try_handle_real_estate_ranking_directly"

        def fake_handler(**kwargs: Any) -> dict[str, Any]:
            calls.append((module_name, callable_name, kwargs))
            return {
                "ok": True,
                "source": "legacy_lazy_fallback",
                "type": "real_estate_ranking",
            }

        return fake_handler

    monkeypatch.setattr(handlers, "_capability_bridge_callable", no_bridge_callable)
    monkeypatch.setattr(handlers, "_query_execution_domain_callable", fake_legacy_import)

    result = handlers.handle_default_direct_response(
        query="q",
        inputs={},
        request_id="req-fallback-ranking",
        llm_intent=None,
        llm_planning_enabled=lambda: False,
    )

    assert result == {
        "ok": True,
        "source": "legacy_lazy_fallback",
        "type": "real_estate_ranking",
    }
    assert calls
    assert calls[0][2]["request_id"] == "req-fallback-ranking"


def test_domain_direct_response_handlers_define_plugin_bridge_boundary() -> None:
    source = HANDLER_PATH.read_text(encoding="utf-8")

    assert "_BRIDGE_PLUGIN_MODULE = \"plugins.real_estate_ranking_bridge\"" in source
    assert "_capability_bridge_callable(" in source
    assert "CapabilityRegistry.from_plugin_modules(" in source
    assert "real_estate_missing_inputs" in source
    assert "real_estate_ranking_direct_handler" in source

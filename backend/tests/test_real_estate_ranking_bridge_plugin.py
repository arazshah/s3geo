"""
Real-estate ranking bridge plugin contract tests.

The real-estate direct-response implementation still lives behind the
application query_execution domain boundary, but the behavior must now be
exposed as plugin/capability metadata so future dispatch can resolve it through
CapabilityRegistry.
"""

from __future__ import annotations

import ast
from pathlib import Path
from types import SimpleNamespace

from orchestrator.capability_registry import CapabilityRegistry
from orchestrator.plugin_modules import DEFAULT_SAFE_PLUGIN_MODULES


PLUGIN_MODULE = "plugins.real_estate_ranking_bridge"
PLUGIN_PATH = Path("plugins/real_estate_ranking_bridge.py")


def test_real_estate_ranking_bridge_is_in_default_safe_plugin_modules() -> None:
    assert PLUGIN_MODULE in DEFAULT_SAFE_PLUGIN_MODULES


def test_real_estate_ranking_bridge_has_no_top_level_application_real_estate_imports() -> None:
    source = PLUGIN_PATH.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(PLUGIN_PATH))

    offenders: list[str] = []

    for node in tree.body:
        if isinstance(node, ast.ImportFrom):
            module = node.module or ""
            if module.startswith("smart_spatial_system.application") and "real_estate" in module:
                offenders.append(module)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if (
                    alias.name.startswith("smart_spatial_system.application")
                    and "real_estate" in alias.name
                ):
                    offenders.append(alias.name)

    assert offenders == []


def test_real_estate_ranking_bridge_registers_expected_capabilities() -> None:
    registry = CapabilityRegistry.from_plugin_modules([PLUGIN_MODULE])

    assert registry.registered_plugin_ids() == ["real_estate_ranking_bridge"]

    registered = set(registry.registered_capability_names())

    assert "try_handle_missing_real_estate_inputs" in registered
    assert "try_handle_real_estate_ranking_directly" in registered

    ranking_binding = registry.resolve("try_handle_real_estate_ranking_directly")
    missing_binding = registry.resolve("try_handle_missing_real_estate_inputs")

    assert ranking_binding.plugin_id == "real_estate_ranking_bridge"
    assert missing_binding.plugin_id == "real_estate_ranking_bridge"
    assert callable(ranking_binding.callable)
    assert callable(missing_binding.callable)


def test_real_estate_ranking_bridge_capabilities_are_direct_dispatch_only_bridge_metadata() -> None:
    registry = CapabilityRegistry.from_plugin_modules([PLUGIN_MODULE])

    for capability_name in [
        "try_handle_missing_real_estate_inputs",
        "try_handle_real_estate_ranking_directly",
    ]:
        descriptor = registry.descriptor_for(capability_name)
        binding = registry.resolve(capability_name)
        metadata = dict(getattr(descriptor, "metadata", {}) or {})

        assert metadata["category"] == "domain_bridge"
        assert metadata["domain"] == "real_estate"
        assert metadata["direct_dispatch_only"] is True
        assert metadata["keyword_routable"] is False
        assert metadata["compatibility_bridge"] is True

        # The SDK may normalize descriptor metadata such as ``routable``.
        # For this bridge, the important routing contract is that no keywords
        # are exposed for keyword/semantic selection; future dispatch should
        # resolve these capabilities by exact capability name.
        assert binding.keywords == []


def test_real_estate_ranking_bridge_lazy_delegates_missing_inputs(monkeypatch) -> None:
    import plugins.real_estate_ranking_bridge as bridge

    calls: list[tuple[str, tuple[object, ...], dict[str, object]]] = []

    def fake_import_module(module_name: str):
        assert module_name.endswith(".real_estate_missing_inputs")

        def fake_handler(*args, **kwargs):
            calls.append((module_name, args, kwargs))
            return {"ok": False, "type": "missing_inputs"}

        return SimpleNamespace(
            try_handle_missing_real_estate_inputs=fake_handler,
        )

    monkeypatch.setattr(bridge.importlib, "import_module", fake_import_module)

    result = bridge.try_handle_missing_real_estate_inputs(
        "ctx",
        query="q",
        inputs={},
    )

    assert result == {"ok": False, "type": "missing_inputs"}
    assert calls
    assert calls[0][1] == ("ctx",)
    assert calls[0][2]["query"] == "q"


def test_real_estate_ranking_bridge_lazy_delegates_ranking_handler(monkeypatch) -> None:
    import plugins.real_estate_ranking_bridge as bridge

    calls: list[tuple[str, tuple[object, ...], dict[str, object]]] = []

    def fake_import_module(module_name: str):
        assert module_name.endswith(".real_estate_ranking_direct_handler")

        def fake_handler(*args, **kwargs):
            calls.append((module_name, args, kwargs))
            return {"ok": True, "type": "real_estate_ranking"}

        return SimpleNamespace(
            try_handle_real_estate_ranking_directly=fake_handler,
        )

    monkeypatch.setattr(bridge.importlib, "import_module", fake_import_module)

    result = bridge.try_handle_real_estate_ranking_directly(
        "ctx",
        query="q",
        inputs={},
    )

    assert result == {"ok": True, "type": "real_estate_ranking"}
    assert calls
    assert calls[0][1] == ("ctx",)
    assert calls[0][2]["query"] == "q"

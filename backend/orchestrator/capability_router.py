"""
orchestrator.capability_router

A simple capability router for the first natural-query runtime.

For now this router uses explicit bindings to real plugin functions.
Later it should be replaced with a registry-backed router that scores capabilities.
"""

from __future__ import annotations


def _default_capability_handlers() -> dict[str, Any]:
    """
    Build default handlers through the centralized capability registry.

    This avoids importing concrete plugin modules directly from core router code.
    """
    from orchestrator.capability_registry import CapabilityRegistry
    from orchestrator.plugin_modules import DEFAULT_SAFE_PLUGIN_MODULES

    registry = CapabilityRegistry.from_plugin_modules(DEFAULT_SAFE_PLUGIN_MODULES)

    names = (
        "calculate_spectral_index",
        "threshold_raster",
        "raster_to_vector",
    )

    handlers: dict[str, Any] = {}
    for name in names:
        try:
            handlers[name] = registry.resolve(name)
        except Exception:
            continue

    return handlers


from orchestrator.models import CapabilityBinding


class SimpleCapabilityRouter:
    """
    Minimal capability router.

    Maps abstract operation names to real plugin functions.
    """

    def __init__(self) -> None:
        # The centralized registry returns validated CapabilityBinding objects.
        # Do not recreate them here: concrete plugin callables are intentionally
        # not imported into this lightweight router module.
        self._bindings: dict[str, CapabilityBinding] = _default_capability_handlers()

    def resolve(self, capability_name: str) -> CapabilityBinding:
        if capability_name not in self._bindings:
            raise ValueError(f"Capability '{capability_name}' is not registered in router.")
        return self._bindings[capability_name]

    def registered_capability_names(self) -> list[str]:
        return sorted(self._bindings.keys())

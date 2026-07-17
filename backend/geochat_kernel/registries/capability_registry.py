# geochat_kernel/registries/capability_registry.py
from __future__ import annotations

from geochat_kernel.models.capability import CapabilityDescriptor


class CapabilityRegistry:
    """
    Central registry of all capabilities declared by plugins/components.

    The kernel does not interpret domain capability names; it only indexes
    descriptors so planners/executors/tools can discover what exists.
    """

    def __init__(self) -> None:
        self._capabilities: dict[str, CapabilityDescriptor] = {}
        self._by_kind: dict[str, set[str]] = {}
        self._by_plugin: dict[str, set[str]] = {}

    def register(self, capability: CapabilityDescriptor, *, replace: bool = False) -> None:
        if capability.id in self._capabilities and not replace:
            raise ValueError(f"Duplicate capability id: {capability.id}")

        self._capabilities[capability.id] = capability
        self._by_kind.setdefault(capability.kind, set()).add(capability.id)

        if capability.plugin_id:
            self._by_plugin.setdefault(capability.plugin_id, set()).add(capability.id)

    def register_many(
        self,
        capabilities: list[CapabilityDescriptor],
        *,
        plugin_id: str | None = None,
        replace: bool = False,
    ) -> None:
        for cap in capabilities:
            if plugin_id and not cap.plugin_id:
                cap.plugin_id = plugin_id
            self.register(cap, replace=replace)

    def get(self, capability_id: str) -> CapabilityDescriptor | None:
        return self._capabilities.get(capability_id)

    def all(self) -> list[CapabilityDescriptor]:
        return list(self._capabilities.values())

    def by_kind(self, kind: str) -> list[CapabilityDescriptor]:
        return [
            self._capabilities[cid]
            for cid in self._by_kind.get(kind, set())
            if cid in self._capabilities
        ]

    def by_plugin(self, plugin_id: str) -> list[CapabilityDescriptor]:
        return [
            self._capabilities[cid]
            for cid in self._by_plugin.get(plugin_id, set())
            if cid in self._capabilities
        ]

    def find_by_step_type(self, step_type: str) -> list[CapabilityDescriptor]:
        return [
            cap
            for cap in self._capabilities.values()
            if step_type in cap.handles_step_types
        ]

    def find_by_intent(self, intent: str) -> list[CapabilityDescriptor]:
        return [
            cap
            for cap in self._capabilities.values()
            if intent in cap.handles_intents
        ]

    def routable(self) -> list[CapabilityDescriptor]:
        """
        Return only user-facing capabilities that the Router may select.

        Component descriptors may be registered in the same registry, but they
        must not be visible to the Router.
        """
        return [
            cap
            for cap in self._capabilities.values()
            if getattr(cap, "is_routable_for_router", False)
        ]

    def clear(self) -> None:
        self._capabilities.clear()
        self._by_kind.clear()
        self._by_plugin.clear()

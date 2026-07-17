# geochat_sdk/decorators.py
from __future__ import annotations

from typing import Any, Callable

from geochat_kernel.models.capability import CapabilityDescriptor


class CapabilityRegistration:
    """
    Internal registry descriptor for a decorated capability.
    """

    def __init__(
        self,
        func: Callable,
        name: str,
        keywords: list[str] | None = None,
        description: str | None = None,
        required_inputs: list[str] | None = None,
        optional_inputs: list[str] | None = None,
        output_kind: str | None = None,
        requires_permissions: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.func = func
        self.name = name
        self.keywords = keywords or []
        self.description = description or func.__doc__ or f"Geospatial capability: {name}"
        self.required_inputs = required_inputs or []
        self.optional_inputs = optional_inputs or []
        self.output_kind = output_kind or "payload"
        self.requires_permissions = requires_permissions or []
        self.metadata = metadata or {}

    def build_descriptor(self, plugin_id: str) -> CapabilityDescriptor:
        return CapabilityDescriptor(
            name=self.name,
            kind="capability",
            plugin_id=plugin_id,
            component_name=f"handler_{plugin_id}_{self.func.__name__}",
            description=self.description,
            keywords=self.keywords,
            required_inputs=self.required_inputs,
            optional_inputs=self.optional_inputs,
            output_kind=self.output_kind,
            requires_permissions=self.requires_permissions,
            metadata={**self.metadata, "routable": True},
        )


_PENDING_CAPABILITIES: list[CapabilityRegistration] = []


def capability(
    name: str,
    *,
    keywords: list[str] | None = None,
    description: str | None = None,
    required_inputs: list[str] | None = None,
    optional_inputs: list[str] | None = None,
    output_kind: str | None = None,
    permissions: list[Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Callable[[Callable], Callable]:
    """
    Declare a function as a routable geospatial capability.
    """
    def decorator(func: Callable) -> Callable:
        perm_list = []
        if permissions:
            for p in permissions:
                perm_list.append(p.value if hasattr(p, "value") else str(p))

        reg = CapabilityRegistration(
            func=func,
            name=name,
            keywords=keywords,
            description=description,
            required_inputs=required_inputs,
            optional_inputs=optional_inputs,
            output_kind=output_kind,
            requires_permissions=perm_list,
            metadata=metadata,
        )
        _PENDING_CAPABILITIES.append(reg)
        setattr(func, "__geochat_capability__", reg)
        return func
    return decorator

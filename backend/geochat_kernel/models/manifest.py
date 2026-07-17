# geochat_kernel/models/manifest.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.capability import CapabilityDescriptor
from geochat_kernel.models.vocabulary import Permission


class PluginManifest(KernelModel):
    """
    Formal manifest for a trusted Python plugin.

    Decisions:
    - Plugins are trusted for now, but permissions are declared from day one
      (Q22/Q23) so future sandbox/permission enforcement can be activated.
    - Plugins may depend on other plugins (Q7).
    - Plugins have priority/order (Q8). Lower priority value runs earlier.
    - A plugin can register multiple components/capabilities (Q6).
    """

    id: str
    version: str

    name: str | None = None
    description: str | None = None
    author: str | None = None

    # lower number = earlier execution / registration order
    priority: int = 100

    # plugin ids this plugin depends on
    dependencies: list[str] = Field(default_factory=list)

    # declared permissions; USER_LOCATION is required to access user location
    permissions: list[Permission] = Field(default_factory=list)

    # capabilities/components provided by this plugin
    capabilities: list[CapabilityDescriptor] = Field(default_factory=list)

    # optional compatibility constraints
    min_kernel_version: str | None = None
    max_kernel_version: str | None = None

    enabled: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)

    def declares_permission(self, permission: Permission | str) -> bool:
        value = permission.value if isinstance(permission, Permission) else permission
        return any(p.value == value for p in self.permissions)

    @property
    def has_user_location_permission(self) -> bool:
        return self.declares_permission(Permission.USER_LOCATION)

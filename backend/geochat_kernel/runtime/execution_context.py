# geochat_kernel/runtime/execution_context.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import Field, PrivateAttr

from geochat_kernel.errors import KernelPermissionError
from geochat_kernel.models.audit import AuditRecord
from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.manifest import PluginManifest
from geochat_kernel.models.trace import ExecutionTrace
from geochat_kernel.models.vocabulary import Permission


class UserLocation(KernelModel):
    """
    Protected user location payload.

    This object is intentionally stored as a PrivateAttr inside ExecutionContext
    so it is not serialized accidentally into trace/audit/remote payloads.
    """

    lat: float
    lon: float
    accuracy_m: float | None = None
    source: str | None = None
    timestamp: datetime | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ExecutionContext(KernelModel):
    """
    Runtime context for one user request.

    Important security rule:
    Plugins/components must access location only via:
        context.get_user_location(plugin_manifest)

    If the manifest does not declare Permission.USER_LOCATION, access is denied.
    """

    request_id: str = Field(default_factory=lambda: f"req_{uuid4().hex}")
    session_id: str | None = None
    user_id: str | None = None

    raw_text: str | None = None
    language: str = "unknown"
    dataset_id: str | None = None

    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    trace: ExecutionTrace = Field(default_factory=ExecutionTrace)

    # request-scoped flags for audit/security
    permissions_used: list[str] = Field(default_factory=list)
    user_location_accessed: bool = False
    sensitive_data_accessed: bool = False

    # optional audit record produced by QueryPipeline
    audit_record: AuditRecord | None = None

    # open runtime metadata
    metadata: dict[str, Any] = Field(default_factory=dict)

    # protected private data
    _user_location: UserLocation | None = PrivateAttr(default=None)

    def set_user_location(self, location: UserLocation | None) -> None:
        self._user_location = location

    def has_user_location(self) -> bool:
        return self._user_location is not None

    def get_user_location(
        self,
        manifest: PluginManifest,
    ) -> UserLocation | None:
        """
        Permission-gated user location access.

        Even though plugins are trusted now, USER_LOCATION permission is enforced
        from day one because user explicitly required it.
        """
        if self._user_location is None:
            return None

        if not manifest.declares_permission(Permission.USER_LOCATION):
            raise KernelPermissionError(
                "Plugin attempted to access user_location without declaring permission.",
                details={
                    "plugin_id": manifest.id,
                    "required_permission": Permission.USER_LOCATION.value,
                },
            )

        self.user_location_accessed = True
        value = Permission.USER_LOCATION.value
        if value not in self.permissions_used:
            self.permissions_used.append(value)

        return self._user_location

    def mark_permission_used(self, permission: Permission | str) -> None:
        value = permission.value if isinstance(permission, Permission) else permission
        if value not in self.permissions_used:
            self.permissions_used.append(value)

    def elapsed_ms(self) -> float:
        delta = datetime.now(timezone.utc) - self.started_at
        return delta.total_seconds() * 1000

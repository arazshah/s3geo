# geochat_kernel/contracts/hooks.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.vocabulary import HookPoint


class HookContext(KernelModel):
    """
    Lightweight context passed to hook-capable components.

    MVP actively uses only:
    - HookPoint.ON_QUERY_PARSED
    - HookPoint.ON_RESPONSE_COMPOSED

    But all HookPoint values are already defined in vocabulary for future
    expansion without changing plugin contracts.
    """

    hook_point: HookPoint | str
    request_id: str | None = None
    session_id: str | None = None
    plugin_id: str | None = None
    component_name: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

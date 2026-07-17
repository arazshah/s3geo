# geochat_kernel/models/error_info.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel


class ErrorInfo(KernelModel):
    """
    Standard, transport-agnostic error payload.

    Describes *what* went wrong, never *how* to render it. Independent from
    language, provider, transport, and UI.
    """

    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    recoverable: bool = True

# geochat_kernel/models/tool_result.py
from __future__ import annotations

from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.error_info import ErrorInfo


class ToolResult(KernelModel):
    """
    Uniform success/failure envelope for tools and lightweight components.

    Note: DAG step outputs use ExecutionArtifact (richer, remote-friendly).
    ToolResult stays the simple envelope for tool-level calls.
    """

    ok: bool
    data: Any = None
    error: ErrorInfo | None = None
    warnings: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)

    @classmethod
    def success(
        cls,
        data: Any = None,
        *,
        warnings: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        confidence: float | None = None,
    ) -> "ToolResult":
        return cls(
            ok=True,
            data=data,
            error=None,
            warnings=list(warnings or []),
            metadata=dict(metadata or {}),
            confidence=confidence,
        )

    @classmethod
    def failure(
        cls,
        *,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
        recoverable: bool = True,
        warnings: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
        confidence: float | None = None,
    ) -> "ToolResult":
        return cls(
            ok=False,
            data=None,
            error=ErrorInfo(
                code=code,
                message=message,
                details=dict(details or {}),
                recoverable=recoverable,
            ),
            warnings=list(warnings or []),
            metadata=dict(metadata or {}),
            confidence=confidence,
        )

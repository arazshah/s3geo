# geochat_kernel/models/execution_artifact.py
from __future__ import annotations

from typing import Any
from uuid import uuid4

from pydantic import Field, PrivateAttr

from geochat_kernel.models.base import KernelModel


class ExecutionArtifact(KernelModel):
    """
    The data unit that flows BETWEEN steps in the DAG.

    Q2 decision (live vs serialized):
    - LOCAL execution: a step may attach a live, non-serializable object
      (e.g. a GeoDataFrame, an xarray dataset) via `attach_live(obj)`. This
      stays in-process and is NEVER serialized.
    - REMOTE execution: the executor MUST call `to_dict()` / `from_dict()`,
      which serialize ONLY the JSON-friendly fields. The live object is
      dropped on serialization (a remote handler must rebuild from `payload`
      / `refs` instead).

    This keeps the kernel JSON-friendly by contract while allowing zero-copy,
    high-performance local execution.

    `kind` is an OPEN string (e.g. "vector", "raster_ref", "table", "scalar",
    "geojson", "model_output", ...). The kernel never interprets it.
    """

    id: str = Field(default_factory=lambda: f"art_{uuid4().hex}")
    step_id: str | None = None
    kind: str = "generic"

    # JSON-friendly transportable content (always safe to serialize)
    payload: dict[str, Any] = Field(default_factory=dict)

    # references to external resources (file paths, asset ids, RasterRef ids…)
    refs: list[str] = Field(default_factory=list)

    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    produced_by: str | None = None      # handler/component name
    is_remote: bool = False             # produced via remote compute (Q15)
    metadata: dict[str, Any] = Field(default_factory=dict)

    # --- live, in-process object (NEVER serialized) ---
    _live: Any = PrivateAttr(default=None)

    # ------------------------------------------------------------------ #
    # Live object handling (local execution only)                          #
    # ------------------------------------------------------------------ #

    def attach_live(self, obj: Any) -> "ExecutionArtifact":
        """Attach a live in-process object for local execution (not serialized)."""
        self._live = obj
        return self

    def get_live(self) -> Any:
        """Return the attached live object, or None if not present / remote."""
        return self._live

    @property
    def has_live(self) -> bool:
        return self._live is not None

    # ------------------------------------------------------------------ #
    # Serialization (drops the live object by design)                      #
    # ------------------------------------------------------------------ #

    def to_dict(self) -> dict[str, Any]:
        """
        Serialize JSON-friendly fields only. The live object is intentionally
        excluded (PrivateAttr is not part of the model schema), so remote
        transport stays clean.
        """
        return super().to_dict()

    # convenience factories ------------------------------------------------ #

    @classmethod
    def of_payload(
        cls,
        kind: str,
        payload: dict[str, Any],
        *,
        step_id: str | None = None,
        produced_by: str | None = None,
        confidence: float | None = None,
    ) -> "ExecutionArtifact":
        return cls(
            kind=kind,
            payload=payload,
            step_id=step_id,
            produced_by=produced_by,
            confidence=confidence,
        )

    @classmethod
    def of_live(
        cls,
        kind: str,
        live_obj: Any,
        *,
        payload: dict[str, Any] | None = None,
        step_id: str | None = None,
        produced_by: str | None = None,
        confidence: float | None = None,
    ) -> "ExecutionArtifact":
        """
        Local-only artifact carrying a live object. `payload` should still hold
        a minimal JSON-friendly summary so downstream/remote steps can degrade
        gracefully if the live object is unavailable.
        """
        artifact = cls(
            kind=kind,
            payload=dict(payload or {}),
            step_id=step_id,
            produced_by=produced_by,
            confidence=confidence,
        )
        artifact.attach_live(live_obj)
        return artifact

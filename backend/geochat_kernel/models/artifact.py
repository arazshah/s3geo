# geochat_kernel/models/artifact.py
from __future__ import annotations

from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.base import KernelModel
from geochat_kernel.models.vocabulary import ArtifactKind


class GeoArtifact(KernelModel):
    """
    A user-facing output unit produced for the final response (Q19).

    A single response may carry MANY artifacts of different kinds (features,
    map layer, raster ref, table, chart, report, route, download, scalar...).

    This is a thin envelope: the kernel does not interpret artifact content.
    Plugins (ArtifactBuilders / composers) produce them; the UI renders them.

    `kind` is OPEN (canonical values in vocabulary.ArtifactKind).
    The concrete payload lives in `payload` (JSON-friendly) and/or `ref_id`
    (e.g. pointing to a RasterRef or MapLayer carried by the GeoResponse).
    """

    id: str = Field(default_factory=lambda: f"gart_{uuid4().hex}")
    kind: str = ArtifactKind.FEATURES        # open; canonical: ArtifactKind
    title: str | None = None
    description: str | None = None

    payload: dict[str, Any] = Field(default_factory=dict)
    ref_id: str | None = None                # id of a MapLayer/RasterRef/etc.

    # ordering / prominence in the UI
    priority: int = 100
    primary: bool = False                    # the headline artifact, if any

    produced_by: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    metadata: dict[str, Any] = Field(default_factory=dict)

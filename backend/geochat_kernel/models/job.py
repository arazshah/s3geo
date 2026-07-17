# geochat_kernel/models/job.py
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import Field

from geochat_kernel.models.base import KernelModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class JobStatus(str, Enum):
    """Lifecycle states of a long-running async job."""

    PENDING = "pending"      # submitted, not started yet
    RUNNING = "running"      # in progress
    DONE = "done"            # finished successfully, result available
    FAILED = "failed"        # finished with error
    CANCELLED = "cancelled"  # cancelled by user/system

    @property
    def is_terminal(self) -> bool:
        return self in (JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED)


class JobProgress(KernelModel):
    """
    Optional progress information for a running job.

    JSON-friendly by contract. `percent` is the primary signal; `message`
    and `stage` are human/diagnostic hints.
    """

    percent: float = Field(default=0.0, ge=0.0, le=100.0)
    stage: str | None = None
    message: str | None = None
    updated_at: datetime = Field(default_factory=_utcnow)


class AsyncJobRef(KernelModel):
    """
    A transport-safe reference to a long-running job (Q: long_running).

    The kernel never runs heavy work itself; a plugin submits the work to an
    external service (e.g. GEE, a model server, a worker queue) via a
    BaseJobManager and returns this reference. Polling/result-fetching also go
    through the manager.

    Design rules:
    - Fully JSON-friendly (safe for trace/audit/remote transport).
    - The kernel never interprets `service` or `task`; they are opaque labels.
    - `result_ref` points to where the result lives once DONE (file path,
      asset id, artifact id, url...). The actual result is fetched lazily.
    """

    job_id: str = Field(default_factory=lambda: f"job_{uuid4().hex}")

    # opaque routing labels (interpreted only by the owning JobManager)
    service: str                       # e.g. "gee", "worker", "model_server"
    task: str                          # e.g. "landcover_classification"
    manager: str | None = None         # name of the BaseJobManager that owns it

    status: JobStatus = JobStatus.PENDING
    progress: JobProgress = Field(default_factory=JobProgress)

    # where to poll / where the result will be
    poll_url: str | None = None
    result_ref: str | None = None      # path / asset id / artifact id / url

    # diagnostics
    error: str | None = None
    params: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)

    # ------------------------------------------------------------------ #
    # Convenience accessors                                                #
    # ------------------------------------------------------------------ #

    @property
    def is_terminal(self) -> bool:
        return self.status.is_terminal

    @property
    def is_done(self) -> bool:
        return self.status is JobStatus.DONE

    @property
    def is_failed(self) -> bool:
        return self.status is JobStatus.FAILED

    # ------------------------------------------------------------------ #
    # State transitions (return new-ish updated self; in-place by design   #
    # since AsyncJobRef is a mutable transport object)                     #
    # ------------------------------------------------------------------ #

    def mark_running(
        self, *, percent: float | None = None, stage: str | None = None
    ) -> "AsyncJobRef":
        self.status = JobStatus.RUNNING
        if percent is not None or stage is not None:
            self.progress = JobProgress(
                percent=percent if percent is not None else self.progress.percent,
                stage=stage if stage is not None else self.progress.stage,
            )
        self.updated_at = _utcnow()
        return self

    def mark_done(self, *, result_ref: str | None = None) -> "AsyncJobRef":
        self.status = JobStatus.DONE
        if result_ref is not None:
            self.result_ref = result_ref
        self.progress = JobProgress(percent=100.0, stage="done")
        self.updated_at = _utcnow()
        return self

    def mark_failed(self, error: str) -> "AsyncJobRef":
        self.status = JobStatus.FAILED
        self.error = error
        self.updated_at = _utcnow()
        return self

    def mark_cancelled(self) -> "AsyncJobRef":
        self.status = JobStatus.CANCELLED
        self.updated_at = _utcnow()
        return self

    def update_progress(
        self, percent: float, *, stage: str | None = None, message: str | None = None
    ) -> "AsyncJobRef":
        self.progress = JobProgress(percent=percent, stage=stage, message=message)
        self.updated_at = _utcnow()
        return self

    # ------------------------------------------------------------------ #
    # Factory                                                              #
    # ------------------------------------------------------------------ #

    @classmethod
    def pending(
        cls,
        *,
        service: str,
        task: str,
        manager: str | None = None,
        poll_url: str | None = None,
        params: dict[str, Any] | None = None,
        job_id: str | None = None,
    ) -> "AsyncJobRef":
        kwargs: dict[str, Any] = {
            "service": service,
            "task": task,
            "manager": manager,
            "poll_url": poll_url,
            "params": dict(params or {}),
        }
        if job_id is not None:
            kwargs["job_id"] = job_id
        return cls(**kwargs)

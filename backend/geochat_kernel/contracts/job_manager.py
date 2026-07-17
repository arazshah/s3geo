# geochat_kernel/contracts/job_manager.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from geochat_kernel.models.execution_artifact import ExecutionArtifact
from geochat_kernel.models.job import AsyncJobRef


class BaseJobManager(ABC):
    """
    Contract for managing long-running async jobs (Q: long_running).

    The kernel does NOT execute heavy work. A plugin that needs minutes/hours
    of compute (e.g. Google Earth Engine, a remote model server, a worker
    queue) implements this contract. The kernel only:
      - asks the manager to submit a job,
      - polls for status,
      - fetches the result once the job is DONE.

    Implementations live in PLUGINS (httpx/asyncpg/SDKs allowed there).
    The kernel stays dependency-free and JSON-friendly.

    Selection of the right manager for a job is by `name` / `handles_services`,
    mirroring the registry pattern used elsewhere in the kernel.
    """

    #: unique manager name (used for registry lookup)
    name: str = "base_job_manager"

    @property
    def handles_services(self) -> list[str]:
        """
        Opaque service labels this manager can handle (e.g. ["gee"]).
        The registry uses this for routing a submit() to the right manager.
        Empty list means "generic / catch-all".
        """
        return []

    def can_handle(self, service: str) -> bool:
        services = self.handles_services
        return (not services) or (service in services)

    # ------------------------------------------------------------------ #
    # Lifecycle                                                            #
    # ------------------------------------------------------------------ #

    @abstractmethod
    async def submit(
        self,
        *,
        service: str,
        task: str,
        params: dict[str, Any] | None = None,
    ) -> AsyncJobRef:
        """
        Submit a long-running task. MUST return immediately with an
        AsyncJobRef in PENDING/RUNNING state (never block until completion).
        """
        raise NotImplementedError

    @abstractmethod
    async def poll(self, job_id: str) -> AsyncJobRef:
        """
        Return the current state of the job. MUST NOT block; it reflects the
        latest known status (PENDING/RUNNING/DONE/FAILED/CANCELLED).
        """
        raise NotImplementedError

    @abstractmethod
    async def fetch_result(self, job_id: str) -> ExecutionArtifact:
        """
        Fetch the result of a DONE job as an ExecutionArtifact.

        Implementations SHOULD raise KernelExecutionError (or subclass) if the
        job is not DONE yet or has FAILED.
        """
        raise NotImplementedError

    # ------------------------------------------------------------------ #
    # Optional                                                             #
    # ------------------------------------------------------------------ #

    async def cancel(self, job_id: str) -> AsyncJobRef:
        """
        Optionally cancel a running job. Default raises to signal that the
        concrete manager does not support cancellation.
        """
        raise NotImplementedError(
            f"{type(self).__name__} does not support job cancellation"
        )

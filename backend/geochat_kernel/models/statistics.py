# geochat_kernel/models/statistics.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import Field

from geochat_kernel.models.base import KernelModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class CapabilityStatistics(KernelModel):
    """
    Transparent statistical learning record for a capability.

    This is the source of the router's `historical_success` signal.
    It is intentionally simple and auditable:
      - no black-box ML
      - no hidden model updates
      - can be reset/overridden manually
    """

    capability_name: str

    total_invocations: int = 0
    success_count: int = 0
    failure_count: int = 0

    total_latency_ms: float = 0.0
    avg_latency_ms: float = 0.0

    last_success_at: datetime | None = None
    last_failure_at: datetime | None = None
    last_updated: datetime = Field(default_factory=_utcnow)

    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def success_rate(self) -> float:
        """
        Ratio of successful executions.

        If there is no history yet, return neutral prior 0.5 so new
        capabilities are not unfairly punished.
        """
        if self.total_invocations <= 0:
            return 0.5
        return self.success_count / self.total_invocations

    @property
    def failure_rate(self) -> float:
        if self.total_invocations <= 0:
            return 0.5
        return self.failure_count / self.total_invocations

    def record(
        self,
        *,
        success: bool,
        latency_ms: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> "CapabilityStatistics":
        """
        Record one execution outcome.
        """
        self.total_invocations += 1

        now = _utcnow()
        if success:
            self.success_count += 1
            self.last_success_at = now
        else:
            self.failure_count += 1
            self.last_failure_at = now

        if latency_ms is not None:
            latency = max(0.0, float(latency_ms))
            self.total_latency_ms += latency
            self.avg_latency_ms = self.total_latency_ms / self.total_invocations

        if metadata:
            self.metadata.update(metadata)

        self.last_updated = now
        return self


class StatisticsSnapshot(KernelModel):
    """
    Serializable snapshot of all collected capability statistics.

    Useful for:
      - persisting stats to disk/db
      - debug dashboards
      - injecting `stats` into RoutingRequest.context
    """

    capabilities: dict[str, CapabilityStatistics] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=_utcnow)

    def success_rate_map(self) -> dict[str, float]:
        """
        Router-friendly map:
            {"capability_name": success_rate}
        """
        return {
            name: stat.success_rate
            for name, stat in self.capabilities.items()
        }

    def avg_latency_map(self) -> dict[str, float]:
        return {
            name: stat.avg_latency_ms
            for name, stat in self.capabilities.items()
        }

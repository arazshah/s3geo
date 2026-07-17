# geochat_kernel/runtime/stats_collector.py
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from geochat_kernel.models.statistics import (
    CapabilityStatistics,
    StatisticsSnapshot,
)


class StatisticsCollector:
    """
    In-memory transparent statistics collector.

    This is the first layer of self-learning:
      AuditRecord / execution result -> capability statistics
      capability statistics -> RoutingRequest.context["stats"]
      KeywordRouter uses stats as `historical_success`

    Important:
    - This class is intentionally in-memory for the kernel MVP.
    - Persistence should be implemented outside the kernel or behind a future
      storage abstraction.
    - The collector does not make routing decisions; it only supplies signals.
    """

    def __init__(self) -> None:
        self._capabilities: dict[str, CapabilityStatistics] = {}

    # ------------------------------------------------------------------ #
    # Core API                                                            #
    # ------------------------------------------------------------------ #

    def get_or_create(self, capability_name: str) -> CapabilityStatistics:
        if capability_name not in self._capabilities:
            self._capabilities[capability_name] = CapabilityStatistics(
                capability_name=capability_name
            )
        return self._capabilities[capability_name]

    def record_execution(
        self,
        capability_name: str,
        *,
        success: bool,
        latency_ms: float | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> CapabilityStatistics:
        """
        Record one capability execution.
        """
        stat = self.get_or_create(capability_name)
        return stat.record(
            success=success,
            latency_ms=latency_ms,
            metadata=metadata,
        )

    def get(self, capability_name: str) -> CapabilityStatistics | None:
        return self._capabilities.get(capability_name)

    def reset(self, capability_name: str | None = None) -> None:
        """
        Reset stats globally or for one capability.
        """
        if capability_name is None:
            self._capabilities.clear()
        else:
            self._capabilities.pop(capability_name, None)

    # ------------------------------------------------------------------ #
    # Router integration                                                   #
    # ------------------------------------------------------------------ #

    def success_rate_map(self) -> dict[str, float]:
        """
        Router-friendly signal:
            request.context["stats"] = collector.success_rate_map()
        """
        return {
            name: stat.success_rate
            for name, stat in self._capabilities.items()
        }

    def avg_latency_map(self) -> dict[str, float]:
        return {
            name: stat.avg_latency_ms
            for name, stat in self._capabilities.items()
        }

    def router_context(self) -> dict[str, Any]:
        """
        Convenience context object for RoutingRequest.context.
        """
        return {
            "stats": self.success_rate_map(),
            "avg_latency_ms": self.avg_latency_map(),
        }

    # ------------------------------------------------------------------ #
    # Snapshot / persistence-friendly                                      #
    # ------------------------------------------------------------------ #

    def snapshot(self) -> StatisticsSnapshot:
        return StatisticsSnapshot(capabilities=dict(self._capabilities))

    def load_snapshot(self, snapshot: StatisticsSnapshot) -> None:
        self._capabilities = dict(snapshot.capabilities)

    # ------------------------------------------------------------------ #
    # Audit ingestion - flexible                                           #
    # ------------------------------------------------------------------ #

    def ingest_audit_record(self, audit_record: Any) -> list[CapabilityStatistics]:
        """
        Best-effort ingestion from an AuditRecord-like object.

        This is intentionally flexible because AuditRecord shape may evolve.

        Supported patterns:
          1. audit_record.route_decision.selected[*].capability_name
          2. audit_record.capability_name
          3. audit_record.metadata["capability_name"]
          4. audit_record.metadata["capabilities"]

        Success extraction:
          - audit_record.success
          - audit_record.status in {"success", "ok", "done"}
          - audit_record.response.status in {"success", "ok"}
          - otherwise False if error exists, else True

        Latency extraction:
          - audit_record.latency_ms
          - audit_record.execution_ms
          - audit_record.duration_ms
          - audit_record.metadata["latency_ms"]

        The collector never throws for unknown audit shape; it returns [].
        """
        names = self._extract_capability_names(audit_record)
        if not names:
            return []

        success = self._extract_success(audit_record)
        latency_ms = self._extract_latency_ms(audit_record)

        updated: list[CapabilityStatistics] = []
        for name in names:
            updated.append(
                self.record_execution(
                    name,
                    success=success,
                    latency_ms=latency_ms,
                    metadata={"source": "audit_record"},
                )
            )
        return updated

    # ------------------------------------------------------------------ #
    # Extraction helpers                                                   #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _extract_capability_names(audit_record: Any) -> list[str]:
        names: list[str] = []

        # 1. route_decision.selected[*].capability_name
        route_decision = getattr(audit_record, "route_decision", None)
        selected = getattr(route_decision, "selected", None)
        if selected:
            for item in selected:
                name = getattr(item, "capability_name", None)
                if name:
                    names.append(str(name))

        # 2. direct field
        direct = getattr(audit_record, "capability_name", None)
        if direct:
            names.append(str(direct))

        # 3/4. metadata
        metadata = getattr(audit_record, "metadata", None)
        if isinstance(metadata, Mapping):
            one = metadata.get("capability_name")
            if one:
                names.append(str(one))

            many = metadata.get("capabilities")
            if isinstance(many, list):
                names.extend(str(x) for x in many if x)

        # unique preserve order
        seen: set[str] = set()
        unique: list[str] = []
        for n in names:
            if n not in seen:
                unique.append(n)
                seen.add(n)
        return unique

    @staticmethod
    def _extract_success(audit_record: Any) -> bool:
        success = getattr(audit_record, "success", None)
        if isinstance(success, bool):
            return success

        status = getattr(audit_record, "status", None)
        if status is not None:
            value = str(getattr(status, "value", status)).lower()
            if value in {"success", "ok", "done", "completed"}:
                return True
            if value in {"failed", "error", "failure"}:
                return False

        response = getattr(audit_record, "response", None)
        response_status = getattr(response, "status", None)
        if response_status is not None:
            value = str(getattr(response_status, "value", response_status)).lower()
            if value in {"success", "ok", "done", "completed"}:
                return True
            if value in {"failed", "error", "failure"}:
                return False

        error = getattr(audit_record, "error", None)
        if error:
            return False

        metadata = getattr(audit_record, "metadata", None)
        if isinstance(metadata, Mapping):
            meta_success = metadata.get("success")
            if isinstance(meta_success, bool):
                return meta_success

        # default optimistic: if an audit exists and no error is visible,
        # assume successful execution.
        return True

    @staticmethod
    def _extract_latency_ms(audit_record: Any) -> float | None:
        for attr in ("latency_ms", "execution_ms", "duration_ms"):
            value = getattr(audit_record, attr, None)
            if isinstance(value, int | float):
                return float(value)

        metadata = getattr(audit_record, "metadata", None)
        if isinstance(metadata, Mapping):
            value = metadata.get("latency_ms")
            if isinstance(value, int | float):
                return float(value)

        return None

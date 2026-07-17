# geochat_kernel/models/base.py
from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T", bound="KernelModel")


class KernelModel(BaseModel):
    """
    Base for all kernel models.

    Provides uniform JSON-friendly (de)serialization via to_dict/from_dict.
    This is the contract that makes models safe for remote execution and
    audit/trace persistence (decision from Q2/Q3).

    Note: local execution may carry live objects inside `metadata`, but any
    field intended to cross a process/remote boundary must remain JSON-friendly.
    """

    model_config = ConfigDict(
        extra="ignore",
        populate_by_name=True,
        validate_assignment=False,
        ser_json_timedelta="iso8601",
    )

    def to_dict(self) -> dict[str, Any]:
        """JSON-friendly dict (mode='json' so datetime/enums are serialized)."""
        return self.model_dump(mode="json", exclude_none=False)

    def to_compact_dict(self) -> dict[str, Any]:
        """Like to_dict but drops None values (smaller payloads for transport)."""
        return self.model_dump(mode="json", exclude_none=True)

    @classmethod
    def from_dict(cls: type[T], data: dict[str, Any]) -> T:
        return cls.model_validate(data)
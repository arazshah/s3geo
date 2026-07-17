# geochat_kernel/errors/kernel_errors.py
from __future__ import annotations

from collections.abc import Mapping
from typing import Any, ClassVar


class KernelError(Exception):
    """
    Base exception for all kernel-level errors.

    Framework-agnostic and serializable. Every kernel failure is meant to be
    caught by the runtime ErrorBoundary and converted into a GeoResponse.error.
    """

    code: ClassVar[str] = "kernel_error"
    retryable: ClassVar[bool] = False

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: Mapping[str, Any] | None = None,
        cause: BaseException | None = None,
        retryable: bool | None = None,
    ) -> None:
        self._message = message or self.__class__.__name__
        self._code = code or type(self).code
        self._details: dict[str, Any] = dict(details or {})
        self._retryable = type(self).retryable if retryable is None else retryable

        super().__init__(self._message)
        if cause is not None:
            self.__cause__ = cause

    # explicit properties avoid shadowing ClassVars on the instance
    @property
    def message(self) -> str:
        return self._message

    @property
    def code(self) -> str:  # type: ignore[override]
        return self._code

    @property
    def details(self) -> dict[str, Any]:
        return self._details

    @property
    def is_retryable(self) -> bool:
        return self._retryable

    def to_dict(self) -> dict[str, Any]:
        return {
            "error_type": type(self).__name__,
            "code": self._code,
            "message": self._message,
            "details": self._details,
            "retryable": self._retryable,
        }

    @classmethod
    def from_exception(
        cls,
        exc: BaseException,
        *,
        message: str | None = None,
        code: str | None = None,
        details: Mapping[str, Any] | None = None,
        retryable: bool | None = None,
    ) -> KernelError:
        if isinstance(exc, KernelError):
            return exc
        return cls(
            message or str(exc),
            code=code,
            details=details,
            cause=exc,
            retryable=retryable,
        )

    def __repr__(self) -> str:
        return f"{type(self).__name__}(code={self._code!r}, message={self._message!r})"

    def __str__(self) -> str:
        return f"{self._code}: {self._message}"


# --- Configuration / wiring ---------------------------------------------------
class KernelConfigurationError(KernelError):
    code: ClassVar[str] = "kernel_configuration_error"


# --- Registry / components ----------------------------------------------------
class KernelRegistryError(KernelError):
    code: ClassVar[str] = "kernel_registry_error"


class KernelComponentNotFoundError(KernelRegistryError):
    code: ClassVar[str] = "kernel_component_not_found"

    def __init__(
        self,
        component_type: str,
        name: str,
        *,
        message: str | None = None,
        details: Mapping[str, Any] | None = None,
        cause: BaseException | None = None,
    ) -> None:
        merged = {"component_type": component_type, "name": name, **dict(details or {})}
        super().__init__(
            message or f"Kernel component not found: {component_type} '{name}'",
            details=merged,
            cause=cause,
        )


class KernelDuplicateComponentError(KernelRegistryError):
    code: ClassVar[str] = "kernel_duplicate_component"


# --- Plugin lifecycle ---------------------------------------------------------
class KernelPluginError(KernelError):
    code: ClassVar[str] = "kernel_plugin_error"


class KernelDependencyError(KernelPluginError):
    """Raised when plugin dependency resolution fails (missing/cyclic)."""

    code: ClassVar[str] = "kernel_dependency_error"


class KernelPermissionError(KernelError):
    code: ClassVar[str] = "kernel_permission_error"


# --- Query understanding ------------------------------------------------------
class KernelValidationError(KernelError):
    code: ClassVar[str] = "kernel_validation_error"


class KernelParsingError(KernelError):
    code: ClassVar[str] = "kernel_parsing_error"


# --- Planning -----------------------------------------------------------------
class KernelPlanningError(KernelError):
    code: ClassVar[str] = "kernel_planning_error"


# --- Execution ----------------------------------------------------------------
class KernelExecutionError(KernelError):
    code: ClassVar[str] = "kernel_execution_error"


class KernelPlanExecutionError(KernelExecutionError):
    """Raised when DAG execution fails (step failure, cycle, dependency)."""

    code: ClassVar[str] = "kernel_plan_execution_error"


class KernelProviderError(KernelExecutionError):
    code: ClassVar[str] = "kernel_provider_error"


class KernelToolError(KernelExecutionError):
    code: ClassVar[str] = "kernel_tool_error"


class KernelStepHandlerError(KernelExecutionError):
    code: ClassVar[str] = "kernel_step_handler_error"


class KernelLLMError(KernelExecutionError):
    code: ClassVar[str] = "kernel_llm_error"
    retryable: ClassVar[bool] = True


class KernelTimeoutError(KernelExecutionError):
    code: ClassVar[str] = "kernel_timeout_error"
    retryable: ClassVar[bool] = True

    def __init__(
        self,
        operation: str,
        *,
        timeout_seconds: float | None = None,
        message: str | None = None,
        details: Mapping[str, Any] | None = None,
        cause: BaseException | None = None,
    ) -> None:
        merged = {"operation": operation, **dict(details or {})}
        if timeout_seconds is not None:
            merged["timeout_seconds"] = timeout_seconds
        super().__init__(
            message or f"Kernel operation timed out: {operation}",
            details=merged,
            cause=cause,
        )


# --- Result / response --------------------------------------------------------
class KernelFusionError(KernelError):
    code: ClassVar[str] = "kernel_fusion_error"


class KernelResponseCompositionError(KernelError):
    code: ClassVar[str] = "kernel_response_composition_error"


class KernelUnsupportedOperationError(KernelError):
    code: ClassVar[str] = "kernel_unsupported_operation"


# --- Cache --------------------------------------------------------------------
class KernelCacheError(KernelError):
    code: ClassVar[str] = "kernel_cache_error"
    retryable: ClassVar[bool] = True
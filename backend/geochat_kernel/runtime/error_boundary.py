# geochat_kernel/runtime/error_boundary.py
from __future__ import annotations

from typing import Awaitable, Callable, TypeVar

from geochat_kernel.errors import KernelError
from geochat_kernel.models.error_info import ErrorInfo
from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.trace import TraceStatus
from geochat_kernel.runtime.execution_context import ExecutionContext

T = TypeVar("T")


class ErrorBoundary:
    """
    Converts exceptions into GeoResponse.error and updates trace.

    Runtime components can use this boundary to ensure every pipeline failure
    becomes a structured response instead of escaping as a raw exception.
    """

    def __init__(self, context: ExecutionContext) -> None:
        self.context = context

    async def run_response(
        self,
        func: Callable[[], Awaitable[GeoResponse]],
    ) -> GeoResponse:
        try:
            response = await func()
            return response
        except Exception as exc:
            kernel_error = KernelError.from_exception(exc)
            error_info = ErrorInfo(
                code=kernel_error.code,
                message=kernel_error.message,
                details=kernel_error.details,
                recoverable=kernel_error.is_retryable,
            )
            self.context.trace.add_error(error_info)
            self.context.trace.finish(status=TraceStatus.ERROR)

            return GeoResponse.error(
                kernel_error.message,
                request_id=self.context.request_id,
                errors=[kernel_error.message],
                trace=self.context.trace,
                metadata={"kernel_error": kernel_error.to_dict()},
            )

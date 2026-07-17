# geochat_kernel/registries/router_registry.py
from __future__ import annotations

from geochat_kernel.contracts.router import BaseRouter, RoutingRequest
from geochat_kernel.errors import KernelComponentNotFoundError


class RouterRegistry:
    """
    Registry for routing components.

    Routers can be:
      - default kernel router: KeywordRouter
      - semantic router plugin
      - LLM router plugin
      - cascade/composite router

    Selection is based on router.match_score(request).
    """

    def __init__(self) -> None:
        self._routers: dict[str, BaseRouter] = {}

    def register(
        self,
        router: BaseRouter,
        *,
        replace: bool = False,
    ) -> None:
        name = router.name
        if name in self._routers and not replace:
            raise ValueError(f"Router already registered: {name}")
        self._routers[name] = router

    def unregister(self, name: str) -> None:
        self._routers.pop(name, None)

    def get(self, name: str) -> BaseRouter:
        router = self._routers.get(name)
        if router is None:
            raise KernelComponentNotFoundError("router", name)
        return router

    def all(self) -> list[BaseRouter]:
        return list(self._routers.values())

    def names(self) -> list[str]:
        return list(self._routers.keys())

    def __len__(self) -> int:
        return len(self._routers)

    def select_best(self, request: RoutingRequest) -> BaseRouter:
        """
        Select the best router for this request.

        The default KeywordRouter has a low-but-usable match_score, so plugin
        routers can outrank it.
        """
        if not self._routers:
            raise KernelComponentNotFoundError("router", "<any>")

        scored: list[tuple[float, BaseRouter]] = []
        for router in self._routers.values():
            try:
                score = float(router.match_score(request))
            except Exception:
                score = 0.0
            scored.append((score, router))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

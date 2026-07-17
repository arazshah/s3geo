# geochat_kernel/runtime/query_pipeline.py
from __future__ import annotations

from typing import Any

from geochat_kernel.contracts.router import RouterConfig, RoutingRequest
from geochat_kernel.errors import KernelFusionError
from geochat_kernel.models.audit import AuditRecord
from geochat_kernel.models.geo_response import GeoResponse
from geochat_kernel.models.interpretation import RawSegment
from geochat_kernel.models.query_ir import QueryIR
from geochat_kernel.models.trace import TraceStatus
from geochat_kernel.runtime.app_container import KernelAppContainer
from geochat_kernel.runtime.error_boundary import ErrorBoundary
from geochat_kernel.runtime.execution_context import (
    ExecutionContext,
    UserLocation,
)
from geochat_kernel.runtime.hook_manager import HookManager
from geochat_kernel.runtime.plan_executor import PlanExecutor


class QueryPipeline:
    """
    Full GeoChatV2 kernel pipeline.

    Flow:
    1. parse raw text
    2. apply parse stages
    3. semantic enrich
    4. on_query_parsed hook
    5. route                    <-- NEW
    6. plan
    7. optimize plan
    8. execute DAG
    9. fusion
    10. rank
    11. artifact build
    12. compose
    13. on_response_composed hook
    14. audit record generation
    """

    def __init__(self, container: KernelAppContainer) -> None:
        self.container = container
        self.hooks = HookManager(container)
        self.executor = PlanExecutor(container)

    async def run(
        self,
        raw_text: str,
        *,
        context: ExecutionContext | None = None,
        user_location: UserLocation | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> GeoResponse:
        ctx = context or ExecutionContext(raw_text=raw_text)
        ctx.raw_text = raw_text

        if metadata:
            ctx.metadata.update(metadata)

        if user_location is not None:
            ctx.set_user_location(user_location)

        boundary = ErrorBoundary(ctx)
        return await boundary.run_response(lambda: self._run_inner(raw_text, ctx))

    async def _run_inner(
        self,
        raw_text: str,
        context: ExecutionContext,
    ) -> GeoResponse:
        # ------------------------------------------------------------------ #
        # 1) Parse                                                           #
        # ------------------------------------------------------------------ #
        parse_trace = context.trace.start_step(
            "parse",
            phase="parse",
            inputs_summary={"raw_text_length": len(raw_text)},
        )

        parser = None

        if len(self.container.query_parsers) > 0:
            candidates_method = getattr(self.container.query_parsers, "candidates", None)

            if callable(candidates_method):
                candidates = candidates_method(raw_text, context)
                if candidates:
                    parser = candidates[0][0]
            else:
                try:
                    parser = self.container.query_parsers.select_best(raw_text, context)
                except Exception:
                    parser = None

        if parser is not None:
            query_ir = await parser.parse(raw_text, context)
            query_ir.raw_text = query_ir.raw_text or raw_text
            query_ir.parser_info = query_ir.parser_info
            parse_trace.component = parser.name
        else:
            # Minimal fallback IR. Real understanding should come from plugins.
            query_ir = QueryIR(
                raw_text=raw_text,
                language=context.language,
                raw_segments=[RawSegment(text=raw_text, start=0, end=len(raw_text))],
                dataset_id=context.dataset_id,
                session_id=context.session_id,
            )
            parse_trace.component = "fallback"

        parse_trace.outputs_summary = {
            "query_ir_id": query_ir.id,
            "intent": query_ir.intent,
            "entity_count": len(query_ir.entities),
            "relation_count": len(query_ir.relations),
        }
        parse_trace.finish(status=TraceStatus.SUCCESS)

        context.trace.query_ir_id = query_ir.id

        # ------------------------------------------------------------------ #
        # 2) Multi-stage parse enrichment                                    #
        # ------------------------------------------------------------------ #
        for stage in self.container.parse_stages.applicable(query_ir):
            step = context.trace.start_step(
                f"parse_stage.{stage.name}",
                phase="parse",
                component=stage.name,
                query_ir_id=query_ir.id,
            )
            query_ir = await stage.apply(query_ir, context)
            step.outputs_summary = {
                "entity_count": len(query_ir.entities),
                "relation_count": len(query_ir.relations),
                "layers": len(query_ir.interpretation_layers),
            }
            step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 3) Semantic enrich                                                  #
        # ------------------------------------------------------------------ #
        for enricher in self.container.semantic_enrichers.applicable(query_ir):
            step = context.trace.start_step(
                f"semantic_enrich.{enricher.name}",
                phase="semantic",
                component=enricher.name,
                query_ir_id=query_ir.id,
            )
            query_ir = await enricher.enrich(query_ir, context)
            step.outputs_summary = {
                "entity_count": len(query_ir.entities),
                "relation_count": len(query_ir.relations),
            }
            step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 4) MVP Hook: on_query_parsed                                        #
        # ------------------------------------------------------------------ #
        hook_step = context.trace.start_step(
            "hook.on_query_parsed",
            phase="hook",
            query_ir_id=query_ir.id,
        )
        query_ir = await self.hooks.on_query_parsed(query_ir)
        hook_step.outputs_summary = {
            "entity_count": len(query_ir.entities),
            "relation_count": len(query_ir.relations),
        }
        hook_step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 5) Route                                                           #
        # ------------------------------------------------------------------ #
        route_trace = context.trace.start_step(
            "route",
            phase="route",
            query_ir_id=query_ir.id,
        )

        candidates = self._registered_capabilities()
        available_inputs = self._available_inputs_from_context(context)

        router_context = self.container.stats_collector.router_context()
        router_context.update(context.metadata.get("router_context", {}))

        routing_request = RoutingRequest(
            query_ir=query_ir,
            candidates=candidates,
            available_inputs=available_inputs,
            language=query_ir.language or context.language,
            context=router_context,
        )

        router = self.container.routers.select_best(routing_request)
        router_config = self._router_config_from_context(context)

        route_decision = await router.route(routing_request, router_config)

        context.metadata["route_decision"] = route_decision.to_dict()
        context.metadata["routing"] = {
            "router_name": router.name,
            "strategy": route_decision.strategy_used.value,
            "confidence": route_decision.confidence,
            "selected": [
                item.capability_name for item in route_decision.selected
            ],
            "needs_clarification": route_decision.needs_clarification,
            "zone": router_config.zone(route_decision.confidence),
        }

        route_trace.component = router.name
        route_trace.outputs_summary = {
            "router": router.name,
            "strategy": route_decision.strategy_used.value,
            "confidence": route_decision.confidence,
            "selected": [
                item.capability_name for item in route_decision.selected
            ],
            "alternative_count": len(route_decision.alternatives),
            "needs_clarification": route_decision.needs_clarification,
            "zone": router_config.zone(route_decision.confidence),
        }
        route_trace.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 6) Plan                                                            #
        # ------------------------------------------------------------------ #
        plan_trace = context.trace.start_step(
            "plan",
            phase="plan",
            query_ir_id=query_ir.id,
        )
        planner = self.container.planners.select_best(query_ir, context)
        plan = await planner.build_plan(query_ir, context)
        plan.planner_name = planner.name
        problems = plan.validate_dag()
        if problems:
            raise ValueError(f"Planner produced invalid DAG: {problems}")

        plan_trace.component = planner.name
        plan_trace.outputs_summary = {
            "plan_id": plan.id,
            "step_count": len(plan.steps),
            "root_count": len(plan.root_steps),
            "leaf_count": len(plan.leaf_steps),
        }
        plan_trace.finish(status=TraceStatus.SUCCESS)

        context.trace.plan_id = plan.id

        # ------------------------------------------------------------------ #
        # 7) Optimize plan                                                    #
        # ------------------------------------------------------------------ #
        for optimizer in self.container.plan_optimizers.applicable(plan, query_ir):
            step = context.trace.start_step(
                f"plan_optimizer.{optimizer.name}",
                phase="plan",
                component=optimizer.name,
                query_ir_id=query_ir.id,
                plan_id=plan.id,
            )
            plan = await optimizer.optimize(plan, query_ir, context)
            step.outputs_summary = {
                "step_count": len(plan.steps),
                "problems": plan.validate_dag(),
            }
            step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 8) Execute DAG                                                       #
        # ------------------------------------------------------------------ #
        exec_step = context.trace.start_step(
            "execute_plan",
            phase="execute",
            query_ir_id=query_ir.id,
            plan_id=plan.id,
            inputs_summary={"step_count": len(plan.steps)},
        )
        artifacts = await self.executor.execute(plan, context)
        exec_step.outputs_summary = {
            "artifact_count": len(artifacts),
            "artifact_kinds": [a.kind for a in artifacts.values()],
        }
        exec_step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 9) Fusion                                                           #
        # ------------------------------------------------------------------ #
        fusion = self.container.fusions.select_best(query_ir, plan, artifacts, context)
        if fusion is None:
            raise KernelFusionError(
                "No result fusion component registered.",
                details={"query_ir_id": query_ir.id, "plan_id": plan.id},
            )

        fusion_step = context.trace.start_step(
            f"fusion.{fusion.name}",
            phase="fusion",
            component=fusion.name,
            query_ir_id=query_ir.id,
            plan_id=plan.id,
        )
        response = await fusion.fuse(query_ir, plan, artifacts, context)
        response.request_id = context.request_id
        response.query_ir_id = query_ir.id
        response.plan_id = plan.id
        response.session_id = context.session_id
        response.execution_info.planner_name = planner.name
        response.execution_info.fusion_name = fusion.name
        fusion_step.outputs_summary = {
            "feature_count": len(response.features),
            "artifact_count": len(response.artifacts),
            "map_layer_count": len(response.map_layers),
            "raster_ref_count": len(response.raster_refs),
        }
        fusion_step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 10) Rank                                                            #
        # ------------------------------------------------------------------ #
        ranker = self.container.rankers.select_best(query_ir, response, context)
        if ranker is not None:
            rank_step = context.trace.start_step(
                f"rank.{ranker.name}",
                phase="rank",
                component=ranker.name,
                query_ir_id=query_ir.id,
                plan_id=plan.id,
            )
            response = await ranker.rank(response, query_ir, context)
            rank_step.outputs_summary = {
                "feature_count": len(response.features),
                "group_count": len(response.groups),
            }
            rank_step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 11) Artifact builders                                               #
        # ------------------------------------------------------------------ #
        for builder in self.container.artifact_builders.applicable(response, query_ir):
            build_step = context.trace.start_step(
                f"artifact_builder.{builder.name}",
                phase="artifact",
                component=builder.name,
                query_ir_id=query_ir.id,
                plan_id=plan.id,
            )
            response = await builder.build(response, query_ir, context)
            build_step.outputs_summary = {
                "artifact_count": len(response.artifacts),
                "map_layer_count": len(response.map_layers),
                "raster_ref_count": len(response.raster_refs),
            }
            build_step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 12) Compose                                                         #
        # ------------------------------------------------------------------ #
        composer = self.container.composers.select_best(response, query_ir, context)
        if composer is not None:
            compose_step = context.trace.start_step(
                f"compose.{composer.name}",
                phase="compose",
                component=composer.name,
                query_ir_id=query_ir.id,
                plan_id=plan.id,
            )
            response = await composer.compose(response, query_ir, context)
            response.execution_info.composer_name = composer.name
            compose_step.outputs_summary = {
                "has_summary": response.user_message.summary is not None,
                "has_clarification": (
                    response.user_message.clarification_request is not None
                ),
            }
            compose_step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 13) MVP Hook: on_response_composed                                  #
        # ------------------------------------------------------------------ #
        response_hook_step = context.trace.start_step(
            "hook.on_response_composed",
            phase="hook",
            query_ir_id=query_ir.id,
            plan_id=plan.id,
        )
        response = await self.hooks.on_response_composed(response)
        response_hook_step.outputs_summary = {
            "status": response.status,
            "feature_count": len(response.features),
            "artifact_count": len(response.artifacts),
        }
        response_hook_step.finish(status=TraceStatus.SUCCESS)

        # ------------------------------------------------------------------ #
        # 14) Finalize trace + audit                                          #
        # ------------------------------------------------------------------ #
        context.trace.response_id = response.id
        context.trace.finish(status=TraceStatus.SUCCESS)
        response.trace = context.trace
        response.execution_info.execution_time_ms = context.elapsed_ms()
        response.returned = len(response.features)
        if response.total_matched == 0:
            response.total_matched = len(response.features)

        context.audit_record = self._build_audit_record(
            context=context,
            query_ir=query_ir,
            plan=plan,
            response=response,
        )

        return response

    # ------------------------------------------------------------------ #
    # Routing helpers                                                     #
    # ------------------------------------------------------------------ #

    def _registered_capabilities(self) -> list[Any]:
        """
        Return only Router-facing CapabilityDescriptor objects.

        Important:
        CapabilityRegistry may also contain component descriptors such as:
          - query_parser
          - planner
          - step_handler
          - result_fusion
          - artifact_builder
          - response_composer

        Router must NOT select those internal components. It should only see
        real user-facing capabilities where:

            cap.kind == "capability"
            cap.enabled is True
            cap.metadata.get("routable", True) is not False
        """
        registry = self.container.capabilities

        routable_method = getattr(registry, "routable", None)
        if callable(routable_method):
            return list(routable_method())

        values: list[Any] = []

        for method_name in ("all", "list"):
            method = getattr(registry, method_name, None)
            if callable(method):
                values = list(method())
                break

        if not values:
            values_method = getattr(registry, "values", None)
            if callable(values_method):
                values = list(values_method())

        if not values:
            for attr in ("_items", "_capabilities", "_components", "_registry"):
                value = getattr(registry, attr, None)
                if isinstance(value, dict):
                    values = list(value.values())
                    break
                if isinstance(value, list):
                    values = list(value)
                    break

        return [
            cap
            for cap in values
            if getattr(cap, "enabled", True)
            and getattr(cap, "kind", None) == "capability"
            and getattr(cap, "metadata", {}).get("routable", True) is not False
        ]

    @staticmethod
    def _available_inputs_from_context(context: ExecutionContext) -> set[str]:
        """
        Extract available input labels for input_availability hard filtering.

        Preferred:
            metadata["available_inputs"] = ["dem", "rainfall"]

        Also supports:
            metadata["inputs"] = [...]
            metadata["data_inputs"] = [...]
        """
        for key in ("available_inputs", "inputs", "data_inputs"):
            value = context.metadata.get(key)
            if isinstance(value, set):
                return {str(x) for x in value}
            if isinstance(value, list | tuple):
                return {str(x) for x in value}
        return set()

    @staticmethod
    def _router_config_from_context(context: ExecutionContext) -> RouterConfig:
        """
        Build RouterConfig from context.metadata["router_config"] if present.

        Example:
            metadata={
                "router_config": {
                    "high_threshold": 0.85,
                    "medium_threshold": 0.50,
                    "competitive_gap": 0.10,
                }
            }
        """
        raw = context.metadata.get("router_config")
        if isinstance(raw, dict):
            return RouterConfig(**raw)
        return RouterConfig()

    @staticmethod
    def _build_audit_record(
        *,
        context: ExecutionContext,
        query_ir: QueryIR,
        plan: Any,
        response: GeoResponse,
    ) -> AuditRecord:
        return AuditRecord(
            request_id=context.request_id,
            session_id=context.session_id,
            user_id=context.user_id,
            raw_text=context.raw_text,
            language=query_ir.language,
            dataset_id=context.dataset_id,
            query_ir_id=query_ir.id,
            plan_id=plan.id,
            response_id=response.id,
            trace_id=context.trace.id,
            status=response.status,
            duration_ms=context.elapsed_ms(),
            permissions_used=list(context.permissions_used),
            user_location_accessed=context.user_location_accessed,
            sensitive_data_accessed=context.sensitive_data_accessed,
            request={
                "request_id": context.request_id,
                "raw_text": context.raw_text,
                "session_id": context.session_id,
                "dataset_id": context.dataset_id,
            },
            query_ir=query_ir.to_dict(),
            plan=plan.to_dict(),
            response=response.to_dict(),
            trace=context.trace.to_dict(),
            errors=[{"message": e} for e in response.errors],
            warnings=list(response.warnings),
            metadata={
                "routing": context.metadata.get("routing"),
                "route_decision": context.metadata.get("route_decision"),
            },
        )

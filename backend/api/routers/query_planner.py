from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from api.support import (
    http_error_detail as _http_error_detail,
    json_safe as _json_safe,
    service as _service,
)
from orchestrator.service import OrchestratorServiceError


router = APIRouter()


class QueryRequest(BaseModel):
    """
    Frontend-facing natural geospatial query request.

    `inputs` defaults to an empty object so the UI can start with a plain
    natural-language query and attach datasets later when needed.
    """

    query: str | None = Field(
        default=None,
        description="Natural-language geospatial query.",
        examples=["یک تحلیل ساده تستی انجام بده"],
    )
    inputs: dict[str, Any] = Field(
        default_factory=dict,
        description="Input datasets and references keyed by logical name.",
    )
    band_map: dict[str, int] = Field(
        default_factory=dict,
        description="Optional raster band mapping, for example {'red': 3, 'nir': 4}.",
    )
    request_id: str | None = Field(
        default=None,
        description="Optional client-supplied request identifier.",
    )
    user_context: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional user/session context.",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Optional request metadata.",
    )
    min_score: float | None = Field(
        default=None,
        description="Optional minimum routing score.",
    )
    project_id: str | None = Field(
        default=None,
        description="Optional project identifier.",
    )

    model_config = ConfigDict(extra="allow")


class QueryResponse(BaseModel):
    """
    Stable frontend-facing query response contract.

    The backend may include additional diagnostic fields. The fields below are
    the stable surface the UI can rely on.
    """

    status: str = Field(description="Execution status, e.g. completed or failed.")
    request_id: str | None = Field(default=None)
    query: str | None = Field(default=None)
    query_hash: str | None = Field(default=None)
    ok: bool | None = Field(default=None)

    answer: Any = Field(default=None)
    message: str | None = Field(default=None)
    summary: Any = Field(default=None)

    outputs: dict[str, Any] = Field(default_factory=dict)
    layers: list[dict[str, Any]] = Field(default_factory=list)
    map_layers: list[dict[str, Any]] = Field(default_factory=list)
    map: dict[str, Any] = Field(default_factory=dict)

    documents: list[dict[str, Any]] = Field(default_factory=list)
    files: list[dict[str, Any]] = Field(default_factory=list)
    reports: list[dict[str, Any]] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)

    warnings: list[Any] = Field(default_factory=list)
    errors: list[Any] = Field(default_factory=list)
    next_actions: list[Any] = Field(default_factory=list)

    metadata: dict[str, Any] = Field(default_factory=dict)
    confidence: dict[str, Any] = Field(default_factory=dict)
    audit_ref: dict[str, Any] = Field(default_factory=dict)
    trace: list[Any] = Field(default_factory=list)
    steps: list[Any] = Field(default_factory=list)
    structured_error: dict[str, Any] | None = Field(default=None)

    model_config = ConfigDict(extra="allow")


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _normalize_query_response_for_frontend(
    response: Any,
    *,
    query: str,
) -> dict[str, Any]:
    """
    Preserve the service response while adding stable fields for the frontend.

    Existing consumers can keep using legacy fields such as `layers` and
    `map.layers`; new UI code can rely on `query`, `summary`, `map_layers`,
    and `errors` being present.
    """
    payload: dict[str, Any]

    if isinstance(response, dict):
        payload = dict(response)
    else:
        payload = {
            "status": "completed",
            "answer": response,
        }

    status = str(payload.get("status") or "completed")
    payload["status"] = status
    payload.setdefault("query", query)

    ok = payload.get("ok")
    if not isinstance(ok, bool):
        payload["ok"] = status.lower() not in {"failed", "error"}

    summary = payload.get("summary")
    if summary is None:
        summary = payload.get("answer")
    if summary is None:
        summary = payload.get("message")
    if summary is None:
        summary = ""
    payload["summary"] = summary

    outputs = payload.get("outputs")
    if not isinstance(outputs, dict):
        payload["outputs"] = {}

    layers = payload.get("map_layers")
    if not isinstance(layers, list):
        layers = payload.get("layers")
    if not isinstance(layers, list):
        map_payload = payload.get("map")
        if isinstance(map_payload, dict):
            layers = map_payload.get("layers")
    if not isinstance(layers, list):
        layers = []

    payload["layers"] = layers
    payload["map_layers"] = layers

    map_payload = payload.get("map")
    if not isinstance(map_payload, dict):
        map_payload = {}
    map_payload.setdefault("layers", layers)
    payload["map"] = map_payload

    for key in (
        "documents",
        "files",
        "reports",
        "artifacts",
        "warnings",
        "next_actions",
        "trace",
        "steps",
    ):
        payload[key] = _as_list(payload.get(key))

    for key in ("metadata", "confidence", "audit_ref"):
        payload[key] = _as_dict(payload.get(key))

    # Normalize routing evidence into the stable public confidence contract.
    # SimpleResponseBuilder exposes the score under router_decision, while
    # frontend/API consumers expect confidence.score.
    router_decision = _as_dict(payload.get("router_decision"))

    if not router_decision:
        router_decision = _as_dict(
            payload["metadata"].get("router_decision")
        )

    confidence = payload["confidence"]

    if router_decision:
        if confidence.get("score") is None:
            score = router_decision.get("top_score")

            if score is None:
                score = router_decision.get("score")

            if score is None:
                score = router_decision.get("confidence")

            if score is not None:
                try:
                    confidence["score"] = float(score)
                except (TypeError, ValueError):
                    pass

        if confidence.get("level") is None:
            confidence["level"] = router_decision.get("level")

        if confidence.get("llm_action") is None:
            confidence["llm_action"] = router_decision.get("llm_action")

        if confidence.get("is_ambiguous") is None:
            confidence["is_ambiguous"] = router_decision.get(
                "is_ambiguous"
            )

        if confidence.get("competitive_gap") is None:
            competitive_gap = router_decision.get("competitive_gap")

            if competitive_gap is not None:
                try:
                    confidence["competitive_gap"] = float(competitive_gap)
                except (TypeError, ValueError):
                    pass

    # Query-spec planning does not produce router_decision. In that path,
    # preserve the confidence emitted by the LLM intent metadata. A score of
    # 0.0 is valid and must not be treated as missing.
    if confidence.get("score") is None:
        llm_intent = _as_dict(payload["metadata"].get("llm_intent"))
        llm_confidence = llm_intent.get("confidence")

        if isinstance(llm_confidence, (int, float)) and not isinstance(
            llm_confidence, bool
        ):
            confidence["score"] = float(llm_confidence)

    # Successful query-spec planning still needs a non-null public score when
    # the planner did not expose an explicit confidence value. Use the
    # successful planning signal only as a final fallback.
    if confidence.get("score") is None:
        planning_summary = _as_dict(
            payload["metadata"].get("planning_summary")
        )

        if planning_summary.get("success") is True:
            confidence["score"] = 1.0

    payload["confidence"] = confidence

    errors = payload.get("errors")
    if not isinstance(errors, list):
        errors = []

    structured_error = payload.get("structured_error")
    if isinstance(structured_error, dict) and structured_error:
        if not errors:
            errors.append(structured_error)
    elif str(payload.get("status", "")).lower() in {"failed", "error"}:
        message = payload.get("message") or payload.get("answer")
        if message and not errors:
            errors.append({"message": str(message)})

    payload["errors"] = errors

    return payload


@router.post("/planner/intent")
def plan_intent(
    request: Request,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Plan natural geospatial query intent using LLM.

    Does not execute plugins.
    """
    svc = _service(request)

    query = payload.get("query")

    try:
        return _json_safe(svc.plan_intent_with_llm(query))
    except OrchestratorServiceError as exc:
        raise HTTPException(
            status_code=400,
            detail=_http_error_detail(exc),
        ) from exc


@router.post(
    "/query",
    response_model=QueryResponse,
    response_model_exclude_none=True,
)
def query_endpoint(
    request: Request,
    body: QueryRequest = Body(...),
) -> QueryResponse:
    """
    Execute natural geospatial query.

    Expected body:
        {
            "query": "...",
            "inputs": {...},
            "band_map": {...},
            "request_id": "optional",
            "user_context": {...},
            "metadata": {...},
            "min_score": 0.01
        }
    """
    svc = _service(request)

    if hasattr(body, "model_dump"):
        body_payload = body.model_dump()
    else:
        body_payload = body.dict()

    query_text = body_payload.get("query")
    inputs = body_payload.get("inputs")

    if not isinstance(query_text, str) or not query_text.strip():
        raise HTTPException(
            status_code=400,
            detail="'query' must be a non-empty string.",
        )

    if not isinstance(inputs, dict):
        raise HTTPException(
            status_code=400,
            detail="'inputs' must be an object.",
        )

    band_map = body_payload.get("band_map") or {}

    if not isinstance(band_map, dict):
        raise HTTPException(
            status_code=400,
            detail="'band_map' must be an object when provided.",
        )

    user_context = body_payload.get("user_context") or {}

    if not isinstance(user_context, dict):
        raise HTTPException(
            status_code=400,
            detail="'user_context' must be an object when provided.",
        )

    metadata = body_payload.get("metadata") or {}

    if not isinstance(metadata, dict):
        raise HTTPException(
            status_code=400,
            detail="'metadata' must be an object when provided.",
        )

    min_score = body_payload.get("min_score")

    if min_score is not None and not isinstance(min_score, (int, float)):
        raise HTTPException(
            status_code=400,
            detail="'min_score' must be numeric when provided.",
        )

    response = svc.handle_query(
        query=query_text,
        inputs=inputs,
        band_map={
            str(key): int(value)
            for key, value in band_map.items()
        },
        request_id=body_payload.get("request_id"),
        user_context=user_context,
        metadata=metadata,
        min_score=float(min_score) if min_score is not None else None,
        project_id=str(body_payload.get("project_id") or "").strip() or None,
    )

    return QueryResponse(
        **_json_safe(
            _normalize_query_response_for_frontend(
                response,
                query=query_text,
            )
        )
    )


@router.post("/feedback")
def feedback_endpoint(
    request: Request,
    body: dict[str, Any] = Body(...),
) -> dict[str, Any]:
    """
    Submit user feedback for a previous request.

    Expected body:
        {
            "request_id": "...",
            "rating": "correct|incorrect|partial",
            "issue_types": ["route_error"],
            "expected_capability": "threshold_raster",
            "expected_plugin_id": "raster_threshold",
            "comment": "...",
            "user_context": {...}
        }
    """
    svc = _service(request)

    request_id = body.get("request_id")
    rating = body.get("rating")

    if not isinstance(request_id, str) or not request_id.strip():
        raise HTTPException(
            status_code=400,
            detail="'request_id' must be a non-empty string.",
        )

    if not isinstance(rating, str) or not rating.strip():
        raise HTTPException(
            status_code=400,
            detail="'rating' must be a non-empty string.",
        )

    issue_types = body.get("issue_types")

    if issue_types is not None and not isinstance(issue_types, list):
        raise HTTPException(
            status_code=400,
            detail="'issue_types' must be a list when provided.",
        )

    user_context = body.get("user_context")

    if user_context is not None and not isinstance(user_context, dict):
        raise HTTPException(
            status_code=400,
            detail="'user_context' must be an object when provided.",
        )

    try:
        payload = svc.submit_feedback(
            request_id=request_id,
            rating=rating,
            issue_types=issue_types,
            expected_capability=body.get("expected_capability"),
            expected_plugin_id=body.get("expected_plugin_id"),
            comment=body.get("comment"),
            user_context=user_context,
        )
    except OrchestratorServiceError as exc:
        if "Unknown request_id" in str(exc):
            raise HTTPException(
                status_code=404,
                detail=_http_error_detail(exc),
            ) from exc

        raise HTTPException(
            status_code=400,
            detail=_http_error_detail(exc),
        ) from exc

    return _json_safe(payload)


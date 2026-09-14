from typing import Annotated

from fastapi import APIRouter, Header, Request

from ..contracts import (
    ErrorResponse,
    PracticeGradeRequest,
    PracticeGradeResponse,
    PracticeQuestionRequest,
    PracticeQuestionResponse,
)
from ..observability import get_request_id
from ..services import ServiceContainer

router = APIRouter(prefix="/v1/practice", tags=["practice"])

ERROR_RESPONSES = {
    401: {"model": ErrorResponse},
    403: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
    502: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
    504: {"model": ErrorResponse},
}


@router.post(
    "/questions",
    response_model=PracticeQuestionResponse,
    responses=ERROR_RESPONSES,
)
async def generate_question(
    payload: PracticeQuestionRequest,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> PracticeQuestionResponse:
    services: ServiceContainer = request.app.state.services
    services.token_verifier.verify(authorization)
    await services.course_authorizer.require_access(payload.user_id, payload.course_id)
    if services.practice_orchestrator is None:
        raise RuntimeError("Practice orchestration is not configured.")
    return await services.practice_orchestrator.generate_question(
        payload, get_request_id()
    )


@router.post(
    "/grade",
    response_model=PracticeGradeResponse,
    responses=ERROR_RESPONSES,
)
async def grade_answer(
    payload: PracticeGradeRequest,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> PracticeGradeResponse:
    services: ServiceContainer = request.app.state.services
    services.token_verifier.verify(authorization)
    await services.course_authorizer.require_access(payload.user_id, payload.course_id)
    if services.practice_orchestrator is None:
        raise RuntimeError("Practice orchestration is not configured.")
    return await services.practice_orchestrator.grade_answer(payload, get_request_id())

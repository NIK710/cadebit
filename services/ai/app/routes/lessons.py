from typing import Annotated

from fastapi import APIRouter, Header, Request

from ..contracts import ErrorResponse, MicroLessonRequest, MicroLessonResponse
from ..observability import get_request_id
from ..services import ServiceContainer

router = APIRouter(prefix="/v1/micro-lessons", tags=["micro-lessons"])

ERROR_RESPONSES = {
    401: {"model": ErrorResponse},
    403: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
    502: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
    504: {"model": ErrorResponse},
}


@router.post("", response_model=MicroLessonResponse, responses=ERROR_RESPONSES)
async def generate_micro_lesson(
    payload: MicroLessonRequest,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> MicroLessonResponse:
    services: ServiceContainer = request.app.state.services
    services.token_verifier.verify(authorization)
    await services.course_authorizer.require_access(payload.user_id, payload.course_id)
    if services.lesson_orchestrator is None:
        raise RuntimeError("Micro-lesson orchestration is not configured.")
    return await services.lesson_orchestrator.generate(payload, get_request_id())

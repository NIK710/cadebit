from typing import Annotated

from fastapi import APIRouter, Header, Request

from ..contracts import ChatResponse, ChatResponseRequest, ErrorResponse
from ..observability import get_request_id
from ..services import ServiceContainer

router = APIRouter(prefix="/v1/chat", tags=["chat"])

ERROR_RESPONSES = {
    401: {"model": ErrorResponse},
    403: {"model": ErrorResponse},
    422: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
    502: {"model": ErrorResponse},
    503: {"model": ErrorResponse},
    504: {"model": ErrorResponse},
}


@router.post("/responses", response_model=ChatResponse, responses=ERROR_RESPONSES)
async def create_chat_response(
    payload: ChatResponseRequest,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> ChatResponse:
    services: ServiceContainer = request.app.state.services
    services.token_verifier.verify(authorization)
    await services.course_authorizer.require_access(payload.user_id, payload.course_id)
    if services.chat_orchestrator is None:
        raise RuntimeError("Chat orchestration is not configured.")
    return await services.chat_orchestrator.respond(payload, get_request_id())

from typing import Annotated

from fastapi import APIRouter, Header, Request

from ..contracts import ErrorResponse, GenerateRequest, GenerateResponse
from ..observability import get_request_id
from ..services import ServiceContainer

router = APIRouter(prefix="/v1", tags=["generation"])


@router.post(
    "/generate",
    response_model=GenerateResponse,
    responses={
        401: {"model": ErrorResponse},
        403: {"model": ErrorResponse},
        422: {"model": ErrorResponse},
        429: {"model": ErrorResponse},
        502: {"model": ErrorResponse},
        503: {"model": ErrorResponse},
        504: {"model": ErrorResponse},
    },
)
async def generate(
    payload: GenerateRequest,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> GenerateResponse:
    services: ServiceContainer = request.app.state.services
    services.token_verifier.verify(authorization)
    await services.course_authorizer.require_access(payload.user_id, payload.course_id)
    return await services.orchestrator.generate(payload, get_request_id())

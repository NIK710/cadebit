import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .authorization import (
    CourseAccessDeniedError,
    CourseAuthorizationUnavailableError,
    ServiceAuthenticationError,
    ServiceAuthenticationUnavailableError,
)
from .config import get_settings
from .contracts import ErrorDetail, ErrorResponse, HealthResponse
from .embeddings import (
    EmbeddingRateLimitError,
    EmbeddingTimeoutError,
    EmbeddingUnavailableError,
    EmbeddingUpstreamError,
)
from .observability import configure_logging, get_request_id, request_logging_middleware
from .openai_client import (
    GenerationRateLimitError,
    GenerationTimeoutError,
    GenerationUnavailableError,
    GenerationUpstreamError,
)
from .practice import PracticeGroundingUnavailableError
from .retrieval import InvalidTopicScopeError, RetrievalUnavailableError
from .routes.generate import router as generate_router
from .routes.practice import router as practice_router
from .services import ServiceContainer, build_service_container


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorDetail(code=code, message=message, request_id=get_request_id())
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def create_app(services: ServiceContainer | None = None) -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        container = services or await build_service_container(settings)
        app.state.services = container
        try:
            yield
        finally:
            if services is None:
                await container.close()

    application = FastAPI(
        title="CadeBit AI Service",
        version="0.3.0",
        debug=settings.environment == "development",
        lifespan=lifespan,
    )
    if services is not None:
        application.state.services = services
    application.middleware("http")(request_logging_middleware)
    application.include_router(generate_router)
    application.include_router(practice_router)

    @application.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(status="ok")

    exception_mappings: list[tuple[type[Exception], int, str]] = [
        (ServiceAuthenticationError, 401, "service_authentication_failed"),
        (
            ServiceAuthenticationUnavailableError,
            503,
            "service_authentication_unavailable",
        ),
        (CourseAccessDeniedError, 403, "course_access_denied"),
        (InvalidTopicScopeError, 422, "invalid_topic_scope"),
        (
            PracticeGroundingUnavailableError,
            422,
            "practice_grounding_unavailable",
        ),
        (
            CourseAuthorizationUnavailableError,
            503,
            "course_authorization_unavailable",
        ),
        (GenerationTimeoutError, 504, "generation_timeout"),
        (EmbeddingTimeoutError, 504, "retrieval_embedding_timeout"),
        (GenerationRateLimitError, 429, "generation_rate_limited"),
        (EmbeddingRateLimitError, 429, "retrieval_embedding_rate_limited"),
        (GenerationUnavailableError, 503, "generation_unavailable"),
        (EmbeddingUnavailableError, 503, "retrieval_embedding_unavailable"),
        (RetrievalUnavailableError, 503, "retrieval_unavailable"),
        (GenerationUpstreamError, 502, "generation_upstream_error"),
        (EmbeddingUpstreamError, 502, "retrieval_embedding_upstream_error"),
    ]

    for exception_type, status_code, error_code in exception_mappings:

        async def handle_known_error(
            request: Request,
            error: Exception,
            *,
            mapped_status: int = status_code,
            mapped_code: str = error_code,
        ) -> JSONResponse:
            del request
            return _error_response(mapped_status, mapped_code, str(error))

        application.add_exception_handler(exception_type, handle_known_error)

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        del request, error
        return _error_response(
            422,
            "invalid_request",
            "The request body or parameters are invalid.",
        )

    @application.exception_handler(Exception)
    async def handle_unexpected_error(
        request: Request, error: Exception
    ) -> JSONResponse:
        del request
        logging.getLogger("cadebit.error").exception(
            "unhandled request error",
            exc_info=error,
            extra={"event": "request.failed", "request_id": get_request_id()},
        )
        return _error_response(
            500,
            "internal_error",
            "The AI service could not complete the request.",
        )

    return application


app = create_app()

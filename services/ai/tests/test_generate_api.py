import asyncio
from uuid import uuid4

import httpx
import pytest
from app.authorization import CourseAccessDeniedError, ServiceTokenVerifier
from app.contracts import GenerateResponse, GenerationTask
from app.main import create_app
from app.openai_client import (
    GenerationRateLimitError,
    GenerationTimeoutError,
    GenerationUnavailableError,
    GenerationUpstreamError,
)
from app.retrieval import InvalidTopicScopeError
from app.services import ServiceContainer


class AllowAuthorizer:
    async def require_access(self, user_id: str, course_id) -> None:
        assert user_id == "user-1"
        assert course_id


class DenyAuthorizer:
    async def require_access(self, user_id: str, course_id) -> None:
        del user_id, course_id
        raise CourseAccessDeniedError("The user cannot access this course.")


class StubOrchestrator:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error

    async def generate(self, request, request_id: str) -> GenerateResponse:
        if self.error is not None:
            raise self.error
        return GenerateResponse(
            request_id=request_id,
            response_id="response-1",
            task=request.task,
            content="Course material is unavailable.",
            sources=[],
            model="gpt-5.6-luna",
            usage=None,
        )


def make_app(*, authorizer=None, error: Exception | None = None):
    container = ServiceContainer(
        token_verifier=ServiceTokenVerifier("secret"),
        course_authorizer=authorizer or AllowAuthorizer(),  # type: ignore[arg-type]
        orchestrator=StubOrchestrator(error),  # type: ignore[arg-type]
    )
    return create_app(container)


def payload() -> dict[str, str]:
    return {
        "user_id": "user-1",
        "course_id": str(uuid4()),
        "task": GenerationTask.ANSWER,
        "input": "What is a closure?",
    }


def post(app, *, body=None, headers=None) -> httpx.Response:
    async def send() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            return await client.post(
                "/v1/generate", json=body or payload(), headers=headers
            )

    return asyncio.run(send())


def test_generate_requires_service_authentication():
    response = post(make_app())

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "service_authentication_failed"


def test_generate_returns_contract_and_request_id():
    response = post(
        make_app(),
        headers={"Authorization": "Bearer secret", "X-Request-ID": "web-123"},
    )

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "web-123"
    assert response.json() == {
        "request_id": "web-123",
        "response_id": "response-1",
        "task": "answer",
        "content": "Course material is unavailable.",
        "sources": [],
        "model": "gpt-5.6-luna",
        "usage": None,
    }


def test_generate_denies_non_member_before_orchestration():
    response = post(
        make_app(authorizer=DenyAuthorizer()),
        headers={"Authorization": "Bearer secret"},
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "course_access_denied"


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (GenerationTimeoutError("timed out"), 504, "generation_timeout"),
        (GenerationRateLimitError("limited"), 429, "generation_rate_limited"),
        (GenerationUnavailableError("unavailable"), 503, "generation_unavailable"),
        (GenerationUpstreamError("rejected"), 502, "generation_upstream_error"),
    ],
)
def test_generate_maps_upstream_failures(error: Exception, status: int, code: str):
    response = post(
        make_app(error=error),
        headers={"Authorization": "Bearer secret"},
    )

    assert response.status_code == status
    assert response.json()["error"]["code"] == code


def test_generate_returns_stable_validation_error():
    invalid_payload = payload()
    invalid_payload["task"] = "unsupported"
    response = post(
        make_app(),
        body=invalid_payload,
        headers={"Authorization": "Bearer secret"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_request"


def test_generate_rejects_a_topic_outside_the_course():
    response = post(
        make_app(
            error=InvalidTopicScopeError(
                "The selected topic does not belong to this course."
            )
        ),
        headers={"Authorization": "Bearer secret"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "invalid_topic_scope"

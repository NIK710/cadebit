import asyncio
from uuid import uuid4

import httpx
from app.authorization import CourseAccessDeniedError, ServiceTokenVerifier
from app.contracts import PracticeGradeResponse, PracticeQuestionResponse
from app.main import create_app
from app.services import ServiceContainer


class AllowAuthorizer:
    async def require_access(self, user_id: str, course_id) -> None:
        assert user_id == "user-1"
        assert course_id


class DenyAuthorizer:
    async def require_access(self, user_id: str, course_id) -> None:
        del user_id, course_id
        raise CourseAccessDeniedError("The user cannot access this course.")


class StubGenerationOrchestrator:
    async def generate(self, request, request_id):
        raise AssertionError("The generate transport should not be used.")


class StubPracticeOrchestrator:
    def __init__(self) -> None:
        self.calls = 0

    async def generate_question(self, request, request_id):
        self.calls += 1
        return PracticeQuestionResponse(
            request_id=request_id,
            response_id="question-response",
            question="What is a closure?",
            reference_answer="A function retaining its defining environment.",
            grading_rubric="Identify the function and retained defining environment.",
            difficulty=request.difficulty,
            sources=[],
            model="gpt-5.6-luna",
            prompt_version="practice-question-v1",
            usage=None,
        )

    async def grade_answer(self, request, request_id):
        self.calls += 1
        return PracticeGradeResponse(
            request_id=request_id,
            response_id="grade-response",
            score=0.75,
            correct=False,
            feedback="Identify the defining scope.",
            strengths=["Retained environment"],
            gaps=["Defining scope"],
            model="gpt-5.6-luna",
            prompt_version="practice-grading-v1",
            usage=None,
        )


def make_app(authorizer=None):
    practice = StubPracticeOrchestrator()
    container = ServiceContainer(
        token_verifier=ServiceTokenVerifier("secret"),
        course_authorizer=authorizer or AllowAuthorizer(),  # type: ignore[arg-type]
        orchestrator=StubGenerationOrchestrator(),  # type: ignore[arg-type]
        practice_orchestrator=practice,  # type: ignore[arg-type]
    )
    return create_app(container), practice


def post(app, path: str, body: dict) -> httpx.Response:
    async def send() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as client:
            return await client.post(
                path, json=body, headers={"Authorization": "Bearer secret"}
            )

    return asyncio.run(send())


def question_payload() -> dict:
    return {
        "user_id": "user-1",
        "course_id": str(uuid4()),
        "topic_id": str(uuid4()),
        "difficulty": 0.6,
    }


def test_question_endpoint_returns_structured_contract():
    app, _ = make_app()
    response = post(app, "/v1/practice/questions", question_payload())

    assert response.status_code == 200
    assert response.json()["grading_rubric"].startswith("Identify")
    assert response.json()["prompt_version"] == "practice-question-v1"


def test_grade_endpoint_returns_normalized_evidence():
    app, _ = make_app()
    body = question_payload() | {
        "question": "What is a closure?",
        "reference_answer": "Reference",
        "grading_rubric": "Rubric",
        "student_answer": "Answer",
    }
    response = post(app, "/v1/practice/grade", body)

    assert response.status_code == 200
    assert response.json()["score"] == 0.75
    assert response.json()["gaps"] == ["Defining scope"]


def test_cross_course_access_is_denied_before_practice_orchestration():
    app, practice = make_app(DenyAuthorizer())
    response = post(app, "/v1/practice/questions", question_payload())

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "course_access_denied"
    assert practice.calls == 0

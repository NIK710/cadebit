import asyncio
from uuid import uuid4

import httpx
import pytest
from app.authorization import CourseAccessDeniedError, ServiceTokenVerifier
from app.contracts import (
    ExplanationBlock,
    LearnerContext,
    LessonTopic,
    McqBlock,
    McqChoice,
    MicroLesson,
    MicroLessonRequest,
    MicroLessonResponse,
    RecentAssessmentSignal,
    SourceReference,
)
from app.lesson import MicroLessonOrchestrator, calculate_target_difficulty
from app.main import create_app
from app.orchestration import GroundingResult, GroundingSource, RetrievalDiagnostics
from app.practice_client import GeneratedMicroLesson, StructuredModelResponse
from app.services import ServiceContainer
from pydantic import ValidationError


def lesson(topic_id=None, *, with_example: bool = False) -> MicroLesson:
    topic_id = topic_id or uuid4()
    blocks = [
        ExplanationBlock(
            id="teach-1", type="explanation", body="A grounded explanation."
        )
    ]
    if with_example:
        from app.contracts import ExampleBlock

        blocks.append(
            ExampleBlock(
                id="example-1",
                type="example",
                scenario="Apply the concept.",
                steps=["Identify the inputs."],
                takeaway="Use the relationship.",
            )
        )
    blocks.append(
        McqBlock(
            id="check-1",
            type="mcq",
            prompt="Which application is correct?",
            choices=[
                McqChoice(id="a", text="A", feedback="Correct."),
                McqChoice(id="b", text="B", feedback="Reconsider B."),
                McqChoice(id="c", text="C", feedback="Reconsider C."),
                McqChoice(id="d", text="D", feedback="Reconsider D."),
            ],
            correct_choice_id="a",
            explanation="A follows from the explanation.",
            difficulty=0.5,
        )
    )
    return MicroLesson(
        topic=LessonTopic(id=topic_id, name="Scope"),
        learning_objective="Apply one narrow concept.",
        estimated_minutes=7,
        target_difficulty=0.5,
        blocks=blocks,
    )


def request(**context) -> MicroLessonRequest:
    return MicroLessonRequest(
        user_id="user-1",
        course_id=uuid4(),
        topic_id=uuid4(),
        topic_name="Broad scope",
        learner_context=LearnerContext(**context),
    )


def test_contract_allows_instruction_and_mcq_without_example():
    assert [block.type for block in lesson().blocks] == ["explanation", "mcq"]


def test_contract_rejects_a_lesson_without_instruction():
    valid = lesson()
    with pytest.raises(ValidationError):
        MicroLesson(
            topic=valid.topic,
            learning_objective=valid.learning_objective,
            estimated_minutes=valid.estimated_minutes,
            target_difficulty=valid.target_difficulty,
            blocks=[valid.blocks[-1]],
        )


@pytest.mark.parametrize(
    ("context", "expected"),
    [
        ({}, 0.45),
        ({"system_mastery": 0.0}, 0.30),
        ({"system_mastery": 1.0}, 0.85),
        (
            {
                "system_mastery": 0.5,
                "recent_assessments": [
                    RecentAssessmentSignal(correct=True, difficulty=0.4),
                    RecentAssessmentSignal(correct=True, difficulty=0.8),
                ],
            },
            0.675,
        ),
        (
            {
                "system_mastery": 0.0,
                "recent_assessments": [
                    RecentAssessmentSignal(correct=False, difficulty=0.5)
                ],
            },
            0.25,
        ),
    ],
)
def test_v1_difficulty_heuristic_is_deterministic_and_bounded(context, expected):
    assert calculate_target_difficulty(request(**context)) == expected


class StubGrounding:
    def __init__(self):
        self.request = None

    async def retrieve(self, request):
        self.request = request
        source = GroundingSource(
            reference=SourceReference(
                material_id=uuid4(), material_title="Lecture", chunk_id=uuid4()
            ),
            content="Grounded course content.",
        )
        return GroundingResult(
            sources=(source,),
            diagnostics=RetrievalDiagnostics(
                duration_ms=1,
                embedding_input_tokens=1,
                query_characters=1,
                context_characters=1,
                result_count=1,
                top_k=5,
                top_similarity=0.9,
                lowest_similarity=0.9,
                topic_depth=1,
                embedding_model="test",
            ),
        )


class StubClient:
    async def generate_lesson(self, *, instructions, input):
        assert "do not force a rigid" in instructions
        assert "Grounded course content" in input
        return StructuredModelResponse(
            response_id="response-1",
            output=GeneratedMicroLesson.model_validate(
                {
                    **lesson().model_dump(),
                    "blocks": [
                        {
                            "id": "teach-1",
                            "type": "explanation",
                            "heading": None,
                            "body": "A grounded explanation.",
                            "scenario": None,
                            "steps": None,
                            "takeaway": None,
                            "prompt": None,
                            "choices": None,
                            "correct_choice_id": None,
                            "explanation": None,
                            "difficulty": None,
                        },
                        {
                            "id": "check-1",
                            "type": "mcq",
                            "heading": None,
                            "body": None,
                            "scenario": None,
                            "steps": None,
                            "takeaway": None,
                            "prompt": "Which application is correct?",
                            "choices": [
                                {"id": "a", "text": "A", "feedback": "Correct."},
                                {"id": "b", "text": "B", "feedback": "No."},
                                {"id": "c", "text": "C", "feedback": "No."},
                                {"id": "d", "text": "D", "feedback": "No."},
                            ],
                            "correct_choice_id": "a",
                            "explanation": "A follows from the explanation.",
                            "difficulty": 0.5,
                        },
                    ],
                }
            ),
            model="test-model",
            usage=None,
        )


def test_orchestrator_uses_topic_scoped_grounding_and_server_difficulty():
    grounding = StubGrounding()
    lesson_request = request(system_mastery=0.8)
    response = asyncio.run(
        MicroLessonOrchestrator(StubClient(), grounding).generate(  # type: ignore[arg-type]
            lesson_request, "request-1"
        )
    )
    assert grounding.request.topic_id == lesson_request.topic_id
    assert response.lesson.topic.id == lesson_request.topic_id
    assert response.lesson.target_difficulty == 0.74
    assert response.prompt_version == "micro-lesson-v1"


class AllowAuthorizer:
    async def require_access(self, user_id, course_id):
        del user_id, course_id


class DenyAuthorizer:
    async def require_access(self, user_id, course_id):
        del user_id, course_id
        raise CourseAccessDeniedError("Denied.")


class StubLessonOrchestrator:
    def __init__(self):
        self.calls = 0

    async def generate(self, payload, request_id):
        self.calls += 1
        return MicroLessonResponse(
            request_id=request_id,
            response_id="response-1",
            lesson=lesson(payload.topic_id),
            sources=[],
            model="test-model",
            prompt_version="micro-lesson-v1",
        )


class UnusedOrchestrator:
    async def generate(self, request, request_id):
        raise AssertionError("unused")


def post_lesson(authorizer):
    lesson_orchestrator = StubLessonOrchestrator()
    app = create_app(
        ServiceContainer(
            token_verifier=ServiceTokenVerifier("secret"),
            course_authorizer=authorizer,
            orchestrator=UnusedOrchestrator(),  # type: ignore[arg-type]
            lesson_orchestrator=lesson_orchestrator,  # type: ignore[arg-type]
        )
    )
    payload = request().model_dump(mode="json")

    async def send():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.post(
                "/v1/micro-lessons",
                json=payload,
                headers={"Authorization": "Bearer secret"},
            )

    return asyncio.run(send()), lesson_orchestrator


def test_micro_lesson_endpoint_returns_typed_lesson():
    response, orchestrator = post_lesson(AllowAuthorizer())
    assert response.status_code == 200
    assert response.json()["lesson"]["blocks"][1]["type"] == "mcq"
    assert orchestrator.calls == 1


def test_micro_lesson_endpoint_authorizes_before_generation():
    response, orchestrator = post_lesson(DenyAuthorizer())
    assert response.status_code == 403
    assert orchestrator.calls == 0

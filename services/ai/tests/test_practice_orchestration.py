import asyncio
from uuid import uuid4

import pytest
from app.contracts import PracticeGradeRequest, PracticeQuestionRequest, SourceReference
from app.orchestration import GroundingResult, GroundingSource, RetrievalDiagnostics
from app.practice import PracticeGroundingUnavailableError, PracticeOrchestrator
from app.practice_client import GeneratedQuestion, GradedAnswer, StructuredModelResponse


class StubGroundingProvider:
    def __init__(self, with_source: bool = True) -> None:
        self.with_source = with_source
        self.request = None

    async def retrieve(self, request):
        self.request = request
        sources = ()
        if self.with_source:
            sources = (
                GroundingSource(
                    reference=SourceReference(
                        material_id=uuid4(),
                        material_title="Lecture 1",
                        chunk_id=uuid4(),
                    ),
                    content="A closure retains its lexical environment.",
                ),
            )
        return GroundingResult(
            sources=sources,
            diagnostics=RetrievalDiagnostics(
                duration_ms=1,
                embedding_input_tokens=2,
                query_characters=3,
                context_characters=4,
                result_count=len(sources),
                top_k=5,
                top_similarity=0.8 if sources else None,
                lowest_similarity=0.8 if sources else None,
                topic_depth=1,
                embedding_model="embedding-model",
            ),
        )


class StubPracticeClient:
    async def generate_question(self, *, instructions, input):
        assert "only the supplied" in instructions
        assert "A closure retains" in input
        return StructuredModelResponse(
            response_id="q-1",
            output=GeneratedQuestion(
                question="What does a closure retain?",
                reference_answer="Its lexical environment.",
                grading_rubric="Full credit states lexical environment.",
            ),
            model="test-model",
            usage=None,
        )

    async def grade_answer(self, *, instructions, input):
        assert "stored reference answer" in instructions
        assert "Student answer" in input
        return StructuredModelResponse(
            response_id="g-1",
            output=GradedAnswer(
                score=1,
                correct=True,
                feedback="Correct.",
                strengths=["Lexical environment"],
                gaps=[],
            ),
            model="test-model",
            usage=None,
        )


def test_question_generation_uses_topic_scoped_retrieval():
    grounding = StubGroundingProvider()
    orchestrator = PracticeOrchestrator(StubPracticeClient(), grounding)  # type: ignore[arg-type]
    topic_id = uuid4()
    response = asyncio.run(
        orchestrator.generate_question(
            PracticeQuestionRequest(
                user_id="user-1",
                course_id=uuid4(),
                topic_id=topic_id,
                difficulty=0.7,
            ),
            "request-1",
        )
    )

    assert grounding.request.topic_id == topic_id
    assert response.sources[0].material_title == "Lecture 1"


def test_question_generation_requires_grounding():
    orchestrator = PracticeOrchestrator(
        StubPracticeClient(),
        StubGroundingProvider(with_source=False),  # type: ignore[arg-type]
    )
    with pytest.raises(PracticeGroundingUnavailableError):
        asyncio.run(
            orchestrator.generate_question(
                PracticeQuestionRequest(
                    user_id="user-1",
                    course_id=uuid4(),
                    topic_id=uuid4(),
                    difficulty=0.5,
                ),
                "request-1",
            )
        )


def test_grading_uses_the_stored_rubric_contract():
    orchestrator = PracticeOrchestrator(
        StubPracticeClient(),
        StubGroundingProvider(),  # type: ignore[arg-type]
    )
    response = asyncio.run(
        orchestrator.grade_answer(
            PracticeGradeRequest(
                user_id="user-1",
                course_id=uuid4(),
                topic_id=uuid4(),
                question="What is retained?",
                reference_answer="The lexical environment.",
                grading_rubric="Require lexical environment.",
                student_answer="The surrounding scope.",
                difficulty=0.5,
            ),
            "request-2",
        )
    )
    assert response.score == 1
    assert response.prompt_version == "practice-grading-v1"

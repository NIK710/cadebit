import asyncio
from uuid import uuid4

from app.contracts import GenerateRequest, GenerationTask, SourceReference, TokenUsage
from app.openai_client import ModelRequest, ModelResponse
from app.orchestration import (
    GenerationOrchestrator,
    GroundingResult,
    GroundingSource,
    RetrievalDiagnostics,
)


class RecordingClient:
    request: ModelRequest | None = None

    async def generate(self, request: ModelRequest) -> ModelResponse:
        self.request = request
        return ModelResponse(
            response_id="response-1",
            content="A grounded explanation.",
            model="test-model",
            usage=TokenUsage(input_tokens=10, output_tokens=5, total_tokens=15),
        )


class StaticGroundingProvider:
    def __init__(self, sources: tuple[GroundingSource, ...]) -> None:
        self.sources = sources

    async def retrieve(self, request: GenerateRequest) -> GroundingResult:
        del request
        return GroundingResult(
            sources=self.sources,
            diagnostics=RetrievalDiagnostics(
                duration_ms=1,
                embedding_input_tokens=4,
                query_characters=20,
                context_characters=sum(len(source.content) for source in self.sources),
                result_count=len(self.sources),
                top_k=6,
                top_similarity=0.9 if self.sources else None,
                lowest_similarity=0.9 if self.sources else None,
                topic_depth=0,
                embedding_model="test-embedding",
            ),
        )


def make_request() -> GenerateRequest:
    return GenerateRequest(
        user_id="user-1",
        course_id=uuid4(),
        task=GenerationTask.EXPLAIN,
        input="Explain closures.",
    )


def test_orchestrator_returns_structured_source_references():
    reference = SourceReference(
        material_id=uuid4(),
        material_title="Lecture 3",
        chunk_id=uuid4(),
        page_number=4,
        section="Closures",
        excerpt="A closure retains its lexical environment.",
    )
    client = RecordingClient()
    orchestrator = GenerationOrchestrator(
        client,
        StaticGroundingProvider(
            (GroundingSource(reference=reference, content="Course source text"),)
        ),
    )

    response = asyncio.run(orchestrator.generate(make_request(), "request-1"))

    assert response.sources == [reference]
    assert response.request_id == "request-1"
    assert client.request is not None
    assert "Use only the supplied course sources" in client.request.instructions
    assert "Cite supporting sources inline as [1]" in client.request.instructions
    assert str(reference.material_id) in client.request.input
    assert str(reference.chunk_id) in client.request.input


def test_orchestrator_does_not_claim_grounding_without_sources():
    client = RecordingClient()
    orchestrator = GenerationOrchestrator(client, StaticGroundingProvider(()))

    response = asyncio.run(orchestrator.generate(make_request(), "request-2"))

    assert response.sources == []
    assert client.request is not None
    assert "Do not answer from general knowledge" in client.request.instructions

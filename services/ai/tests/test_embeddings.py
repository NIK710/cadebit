import asyncio
from types import SimpleNamespace

from app.embeddings import EMBEDDING_DIMENSIONS, OpenAIEmbeddingClient


def test_query_embedding_returns_usage_and_fixed_dimensions(monkeypatch):
    client = OpenAIEmbeddingClient(
        api_key="test-key",
        model="test-embedding",
        timeout_seconds=5,
        max_retries=0,
    )
    vector = [0.1] * EMBEDDING_DIMENSIONS

    async def create(inputs):
        assert inputs == ["topic-aware query"]
        return SimpleNamespace(
            data=[SimpleNamespace(index=0, embedding=vector)],
            usage=SimpleNamespace(prompt_tokens=7),
        )

    monkeypatch.setattr(client, "_create", create)
    try:
        result = asyncio.run(client.embed_query("topic-aware query"))
    finally:
        asyncio.run(client.close())

    assert result.vector == vector
    assert result.input_tokens == 7

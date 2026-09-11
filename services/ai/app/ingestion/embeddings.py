from typing import Protocol

from openai import AsyncOpenAI

EMBEDDING_DIMENSIONS = 1536
EMBEDDING_BATCH_SIZE = 64


class EmbeddingClient(Protocol):
    @property
    def model(self) -> str: ...

    async def embed(self, inputs: list[str]) -> list[list[float]]: ...


class OpenAIEmbeddingClient:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        max_retries: int,
    ) -> None:
        self._model = model
        self._client = AsyncOpenAI(
            api_key=api_key,
            timeout=timeout_seconds,
            max_retries=max_retries,
        )

    @property
    def model(self) -> str:
        return self._model

    async def embed(self, inputs: list[str]) -> list[list[float]]:
        embeddings: list[list[float]] = []
        for start in range(0, len(inputs), EMBEDDING_BATCH_SIZE):
            response = await self._client.embeddings.create(
                model=self._model,
                input=inputs[start : start + EMBEDDING_BATCH_SIZE],
                dimensions=EMBEDDING_DIMENSIONS,
                encoding_format="float",
            )
            embeddings.extend(
                item.embedding
                for item in sorted(response.data, key=lambda item: item.index)
            )
        if len(embeddings) != len(inputs):
            raise RuntimeError("The embedding response did not match the chunk count.")
        return embeddings

    async def close(self) -> None:
        await self._client.close()

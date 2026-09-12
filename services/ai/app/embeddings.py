import math
from dataclasses import dataclass
from typing import Protocol

import openai
from openai import AsyncOpenAI

EMBEDDING_DIMENSIONS = 1536
EMBEDDING_BATCH_SIZE = 64


@dataclass(frozen=True)
class QueryEmbedding:
    vector: list[float]
    input_tokens: int | None


class EmbeddingClient(Protocol):
    @property
    def model(self) -> str: ...

    async def embed(self, inputs: list[str]) -> list[list[float]]: ...

    async def embed_query(self, text: str) -> QueryEmbedding: ...


class EmbeddingClientError(Exception):
    pass


class EmbeddingTimeoutError(EmbeddingClientError):
    pass


class EmbeddingRateLimitError(EmbeddingClientError):
    pass


class EmbeddingUnavailableError(EmbeddingClientError):
    pass


class EmbeddingUpstreamError(EmbeddingClientError):
    pass


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
            response = await self._create(inputs[start : start + EMBEDDING_BATCH_SIZE])
            embeddings.extend(
                item.embedding
                for item in sorted(response.data, key=lambda item: item.index)
            )
        _validate_embeddings(embeddings, len(inputs))
        return embeddings

    async def embed_query(self, text: str) -> QueryEmbedding:
        response = await self._create([text])
        embeddings = [item.embedding for item in response.data]
        _validate_embeddings(embeddings, 1)
        input_tokens = getattr(response.usage, "prompt_tokens", None)
        return QueryEmbedding(vector=embeddings[0], input_tokens=input_tokens)

    async def _create(self, inputs: list[str]):
        try:
            return await self._client.embeddings.create(
                model=self._model,
                input=inputs,
                dimensions=EMBEDDING_DIMENSIONS,
                encoding_format="float",
            )
        except openai.APITimeoutError as error:
            raise EmbeddingTimeoutError(
                "OpenAI embedding request timed out."
            ) from error
        except openai.RateLimitError as error:
            raise EmbeddingRateLimitError(
                "OpenAI embedding request exceeded its rate limit."
            ) from error
        except (openai.APIConnectionError, openai.InternalServerError) as error:
            raise EmbeddingUnavailableError(
                "OpenAI embeddings are temporarily unavailable."
            ) from error
        except openai.APIError as error:
            raise EmbeddingUpstreamError(
                "OpenAI rejected the embedding request."
            ) from error

    async def close(self) -> None:
        await self._client.close()


def _validate_embeddings(embeddings: list[list[float]], expected: int) -> None:
    if len(embeddings) != expected:
        raise EmbeddingUpstreamError(
            "The embedding response did not match the input count."
        )
    if any(
        len(vector) != EMBEDDING_DIMENSIONS
        or any(not math.isfinite(value) for value in vector)
        for vector in embeddings
    ):
        raise EmbeddingUpstreamError(
            "The embedding response contained an invalid vector."
        )

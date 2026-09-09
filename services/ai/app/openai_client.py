from dataclasses import dataclass
from typing import Protocol

import openai
from openai import AsyncOpenAI

from .contracts import TokenUsage


@dataclass(frozen=True)
class ModelRequest:
    instructions: str
    input: str


@dataclass(frozen=True)
class ModelResponse:
    response_id: str
    content: str
    model: str
    usage: TokenUsage | None


class GenerationClient(Protocol):
    async def generate(self, request: ModelRequest) -> ModelResponse: ...


class GenerationClientError(Exception):
    pass


class GenerationTimeoutError(GenerationClientError):
    pass


class GenerationRateLimitError(GenerationClientError):
    pass


class GenerationUnavailableError(GenerationClientError):
    pass


class GenerationUpstreamError(GenerationClientError):
    pass


class OpenAIGenerationClient:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        max_retries: int,
        max_output_tokens: int,
    ) -> None:
        self._client = AsyncOpenAI(
            api_key=api_key,
            timeout=timeout_seconds,
            max_retries=max_retries,
        )
        self._model = model
        self._max_output_tokens = max_output_tokens

    async def generate(self, request: ModelRequest) -> ModelResponse:
        try:
            response = await self._client.responses.create(
                model=self._model,
                instructions=request.instructions,
                input=request.input,
                reasoning={"effort": "low"},
                max_output_tokens=self._max_output_tokens,
                store=False,
            )
        except openai.APITimeoutError as error:
            raise GenerationTimeoutError("OpenAI request timed out.") from error
        except openai.RateLimitError as error:
            raise GenerationRateLimitError(
                "OpenAI request exceeded its rate limit."
            ) from error
        except (openai.APIConnectionError, openai.InternalServerError) as error:
            raise GenerationUnavailableError(
                "OpenAI is temporarily unavailable."
            ) from error
        except openai.APIError as error:
            raise GenerationUpstreamError("OpenAI rejected the request.") from error

        content = response.output_text.strip()
        if not content:
            raise GenerationUpstreamError("OpenAI returned no text output.")

        usage = None
        if response.usage is not None:
            usage = TokenUsage(
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                total_tokens=response.usage.total_tokens,
            )

        return ModelResponse(
            response_id=response.id,
            content=content,
            model=response.model,
            usage=usage,
        )

    async def close(self) -> None:
        await self._client.close()


class UnavailableGenerationClient:
    async def generate(self, request: ModelRequest) -> ModelResponse:
        del request
        raise GenerationUnavailableError(
            "Generation is unavailable because OPENAI_API_KEY is not configured."
        )

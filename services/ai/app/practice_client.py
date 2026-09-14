from dataclasses import dataclass
from typing import Protocol, TypeVar

import openai
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from .contracts import TokenUsage
from .openai_client import (
    GenerationRateLimitError,
    GenerationTimeoutError,
    GenerationUnavailableError,
    GenerationUpstreamError,
)


class GeneratedQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=4_000)
    reference_answer: str = Field(min_length=1, max_length=8_000)
    grading_rubric: str = Field(min_length=1, max_length=8_000)


class GradedAnswer(BaseModel):
    score: float = Field(ge=0, le=1)
    correct: bool
    feedback: str = Field(min_length=1, max_length=4_000)
    strengths: list[str] = Field(max_length=8)
    gaps: list[str] = Field(max_length=8)


@dataclass(frozen=True)
class StructuredModelResponse:
    response_id: str
    output: GeneratedQuestion | GradedAnswer
    model: str
    usage: TokenUsage | None


class PracticeClient(Protocol):
    async def generate_question(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse: ...

    async def grade_answer(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse: ...


StructuredOutput = TypeVar("StructuredOutput", GeneratedQuestion, GradedAnswer)


class OpenAIPracticeClient:
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

    async def generate_question(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse:
        return await self._parse(instructions, input, GeneratedQuestion)

    async def grade_answer(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse:
        return await self._parse(instructions, input, GradedAnswer)

    async def _parse(
        self,
        instructions: str,
        input: str,
        output_type: type[StructuredOutput],
    ) -> StructuredModelResponse:
        try:
            response = await self._client.responses.parse(
                model=self._model,
                instructions=instructions,
                input=input,
                text_format=output_type,
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

        if response.output_parsed is None:
            raise GenerationUpstreamError(
                "OpenAI did not return the required structured output."
            )
        usage = None
        if response.usage is not None:
            usage = TokenUsage(
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
                total_tokens=response.usage.total_tokens,
            )
        return StructuredModelResponse(
            response_id=response.id,
            output=response.output_parsed,
            model=response.model,
            usage=usage,
        )

    async def close(self) -> None:
        await self._client.close()


class UnavailablePracticeClient:
    async def generate_question(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse:
        del instructions, input
        raise GenerationUnavailableError(
            "Practice generation is unavailable because OPENAI_API_KEY is not configured."
        )

    async def grade_answer(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse:
        del instructions, input
        raise GenerationUnavailableError(
            "Practice grading is unavailable because OPENAI_API_KEY is not configured."
        )

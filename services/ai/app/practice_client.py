import logging
from dataclasses import dataclass
from typing import Literal, Protocol, TypeVar

import openai
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError

from .contracts import LessonTopic, McqChoice, TokenUsage
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


class GeneratedLessonBlock(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    type: Literal["explanation", "example", "mcq"]
    heading: str | None
    body: str | None
    scenario: str | None
    steps: list[str] | None
    takeaway: str | None
    prompt: str | None
    choices: list[McqChoice] | None
    correct_choice_id: str | None
    explanation: str | None
    difficulty: float | None


class GeneratedMicroLesson(BaseModel):
    topic: LessonTopic
    learning_objective: str = Field(min_length=1, max_length=500)
    estimated_minutes: int = Field(ge=3, le=20)
    target_difficulty: float = Field(ge=0, le=1)
    blocks: list[GeneratedLessonBlock] = Field(min_length=2, max_length=12)


@dataclass(frozen=True)
class StructuredModelResponse:
    response_id: str
    output: GeneratedQuestion | GradedAnswer | GeneratedMicroLesson
    model: str
    usage: TokenUsage | None


class PracticeClient(Protocol):
    async def generate_question(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse: ...

    async def grade_answer(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse: ...

    async def generate_lesson(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse: ...


StructuredOutput = TypeVar(
    "StructuredOutput", GeneratedQuestion, GradedAnswer, GeneratedMicroLesson
)


class OpenAIPracticeClient:
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        timeout_seconds: float,
        max_retries: int,
        max_output_tokens: int,
        lesson_max_output_tokens: int | None = None,
    ) -> None:
        self._client = AsyncOpenAI(
            api_key=api_key,
            timeout=timeout_seconds,
            max_retries=max_retries,
        )
        self._model = model
        self._max_output_tokens = max_output_tokens
        self._lesson_max_output_tokens = lesson_max_output_tokens or max_output_tokens

    async def generate_question(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse:
        return await self._parse(instructions, input, GeneratedQuestion)

    async def grade_answer(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse:
        return await self._parse(instructions, input, GradedAnswer)

    async def generate_lesson(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse:
        return await self._parse(
            instructions,
            input,
            GeneratedMicroLesson,
            max_output_tokens=self._lesson_max_output_tokens,
        )

    async def _parse(
        self,
        instructions: str,
        input: str,
        output_type: type[StructuredOutput],
        *,
        max_output_tokens: int | None = None,
    ) -> StructuredModelResponse:
        try:
            response = await self._client.responses.parse(
                model=self._model,
                instructions=instructions,
                input=input,
                text_format=output_type,
                reasoning={"effort": "low"},
                max_output_tokens=max_output_tokens or self._max_output_tokens,
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
            logging.getLogger("cadebit.openai").exception(
                "OpenAI structured response request failed",
                exc_info=error,
                extra={"event": "openai.structured_response.failed"},
            )
            raise GenerationUpstreamError("OpenAI rejected the request.") from error
        except ValidationError as error:
            logging.getLogger("cadebit.openai").exception(
                "OpenAI structured response could not be parsed",
                exc_info=error,
                extra={"event": "openai.structured_response.invalid"},
            )
            raise GenerationUpstreamError(
                "OpenAI returned an incomplete structured response."
            ) from error

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

    async def generate_lesson(
        self, *, instructions: str, input: str
    ) -> StructuredModelResponse:
        del instructions, input
        raise GenerationUnavailableError(
            "Micro-lesson generation is unavailable because OPENAI_API_KEY is not configured."
        )

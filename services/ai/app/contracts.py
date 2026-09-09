from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GenerationTask(StrEnum):
    ANSWER = "answer"
    EXPLAIN = "explain"
    SUMMARIZE = "summarize"
    QUIZ = "quiz"


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str = Field(min_length=1, max_length=255)
    course_id: UUID
    topic_id: UUID | None = None
    task: GenerationTask
    input: str = Field(min_length=1, max_length=12_000)


class SourceReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    material_id: UUID
    material_title: str = Field(min_length=1, max_length=500)
    chunk_id: UUID | None = None
    page_number: int | None = Field(default=None, ge=1)
    section: str | None = Field(default=None, max_length=500)
    excerpt: str | None = Field(default=None, max_length=1_000)


class TokenUsage(BaseModel):
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)
    total_tokens: int = Field(ge=0)


class GenerateResponse(BaseModel):
    request_id: str
    response_id: str
    task: GenerationTask
    content: str
    sources: list[SourceReference]
    model: str
    usage: TokenUsage | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: str

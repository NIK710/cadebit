from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


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


class PracticeQuestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str = Field(min_length=1, max_length=255)
    course_id: UUID
    topic_id: UUID
    difficulty: float = Field(ge=0, le=1)


class PracticeQuestionResponse(BaseModel):
    request_id: str
    response_id: str
    question: str
    reference_answer: str
    grading_rubric: str
    difficulty: float
    sources: list[SourceReference]
    model: str
    prompt_version: str
    usage: TokenUsage | None = None


class PracticeGradeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str = Field(min_length=1, max_length=255)
    course_id: UUID
    topic_id: UUID
    question: str = Field(min_length=1, max_length=12_000)
    reference_answer: str = Field(min_length=1, max_length=12_000)
    grading_rubric: str = Field(min_length=1, max_length=12_000)
    student_answer: str = Field(min_length=1, max_length=12_000)
    difficulty: float = Field(ge=0, le=1)


class PracticeGradeResponse(BaseModel):
    request_id: str
    response_id: str
    score: float = Field(ge=0, le=1)
    correct: bool
    feedback: str
    strengths: list[str]
    gaps: list[str]
    model: str
    prompt_version: str
    usage: TokenUsage | None = None


class LessonTopic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: UUID
    name: str = Field(min_length=1, max_length=160)


class RecentAssessmentSignal(BaseModel):
    model_config = ConfigDict(extra="forbid")

    correct: bool
    difficulty: float = Field(ge=0, le=1)
    misconception: str | None = Field(default=None, max_length=500)


class LearnerContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    system_mastery: float | None = Field(default=None, ge=0, le=1)
    recent_assessments: list[RecentAssessmentSignal] = Field(
        default_factory=list, max_length=8
    )


class MicroLessonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str = Field(min_length=1, max_length=255)
    course_id: UUID
    topic_id: UUID
    topic_name: str = Field(min_length=1, max_length=160)
    topic_context: str | None = Field(default=None, max_length=12_000)
    learner_context: LearnerContext = Field(default_factory=LearnerContext)


class ExplanationBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    type: Literal["explanation"]
    heading: str | None = Field(default=None, max_length=200)
    body: str = Field(min_length=1, max_length=12_000)


class ExampleBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    type: Literal["example"]
    heading: str | None = Field(default=None, max_length=200)
    scenario: str = Field(min_length=1, max_length=6_000)
    steps: list[str] = Field(min_length=1, max_length=8)
    takeaway: str = Field(min_length=1, max_length=4_000)


class McqChoice(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    text: str = Field(min_length=1, max_length=2_000)
    feedback: str = Field(min_length=1, max_length=4_000)
    misconception: str | None = Field(default=None, max_length=1_000)


class McqBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    type: Literal["mcq"]
    prompt: str = Field(min_length=1, max_length=6_000)
    choices: list[McqChoice] = Field(min_length=4, max_length=4)
    correct_choice_id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,64}$")
    explanation: str = Field(min_length=1, max_length=6_000)
    difficulty: float = Field(ge=0, le=1)

    @model_validator(mode="after")
    def validate_choices(self) -> "McqBlock":
        choice_ids = [choice.id for choice in self.choices]
        if len(set(choice_ids)) != len(choice_ids):
            raise ValueError("MCQ choice IDs must be unique.")
        if self.correct_choice_id not in choice_ids:
            raise ValueError("The correct choice must exist in choices.")
        return self


MicroLessonBlock = Annotated[
    ExplanationBlock | ExampleBlock | McqBlock,
    Field(discriminator="type"),
]


class MicroLesson(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: LessonTopic
    learning_objective: str = Field(min_length=1, max_length=500)
    estimated_minutes: int = Field(ge=3, le=20)
    target_difficulty: float = Field(ge=0, le=1)
    blocks: list[MicroLessonBlock] = Field(min_length=2, max_length=12)

    @model_validator(mode="after")
    def validate_lesson_structure(self) -> "MicroLesson":
        block_ids = [block.id for block in self.blocks]
        if len(set(block_ids)) != len(block_ids):
            raise ValueError("Lesson block IDs must be unique.")
        if not any(block.type in {"explanation", "example"} for block in self.blocks):
            raise ValueError("A lesson must include instructional content.")
        mcq_count = sum(block.type == "mcq" for block in self.blocks)
        if not 1 <= mcq_count <= 3:
            raise ValueError("A lesson must include one to three MCQs.")
        return self


class MicroLessonResponse(BaseModel):
    request_id: str
    response_id: str
    lesson: MicroLesson
    sources: list[SourceReference]
    model: str
    prompt_version: str
    usage: TokenUsage | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


class HealthResponse(BaseModel):
    status: str

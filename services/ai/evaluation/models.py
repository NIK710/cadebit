from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CorpusChunk(StrictModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]+$")
    dataset_version: str = Field(min_length=1)
    course: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]+$")
    material: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]+$")
    material_title: str = Field(min_length=1, max_length=500)
    owner: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]+$")
    content: str = Field(min_length=1)
    section: str | None = Field(default=None, max_length=500)
    topic: str | None = None
    embedding_axis: int = Field(ge=0, lt=1536)


class RetrievalCase(StrictModel):
    id: str = Field(pattern=r"^[a-z0-9][a-z0-9_-]+$")
    dataset_version: str = Field(min_length=1)
    user: str
    course: str
    topic: str | None = None
    topic_path: list[str] = Field(default_factory=list)
    task: str
    query: str = Field(min_length=1)
    query_embedding_axis: int = Field(ge=0, lt=1536)
    relevant_chunk_ids: list[str] = Field(min_length=1)
    k: int = Field(ge=1, le=20)


class GenerationKind(StrEnum):
    GROUNDED_ANSWER = "grounded_answer"
    PRACTICE_QUESTION = "practice_question"
    MICRO_LESSON = "micro_lesson"
    COURSE_CHAT = "course_chat"


class EvaluationChatMessage(StrictModel):
    role: str = Field(pattern=r"^(user|assistant)$")
    content: str = Field(min_length=1, max_length=12_000)


class EvaluationSource(StrictModel):
    material_title: str = Field(min_length=1)
    content: str = Field(min_length=1)
    section: str | None = None


class GenerationCase(StrictModel):
    id: str
    dataset_version: str
    kind: GenerationKind
    request: str = Field(min_length=1)
    sources: list[EvaluationSource] = Field(min_length=1)
    expected_facts: list[str] = Field(min_length=1)
    forbidden_claims: list[str] = Field(default_factory=list)
    difficulty: float = Field(default=0.6, ge=0, le=1)
    history: list[EvaluationChatMessage] = Field(default_factory=list, max_length=12)


class GradingCase(StrictModel):
    id: str
    dataset_version: str
    question: str = Field(min_length=1)
    reference_answer: str = Field(min_length=1)
    rubric: str = Field(min_length=1)
    student_answer: str = Field(min_length=1)
    expected_score_min: float = Field(ge=0, le=1)
    expected_score_max: float = Field(ge=0, le=1)
    difficulty: float = Field(default=0.6, ge=0, le=1)
    repeats: int = Field(default=3, ge=2, le=10)

    @model_validator(mode="after")
    def validate_score_range(self) -> "GradingCase":
        if self.expected_score_min > self.expected_score_max:
            raise ValueError("expected_score_min cannot exceed expected_score_max")
        return self


class EvaluationThresholds(StrictModel):
    retrieval_recall_at_k: float = Field(ge=0, le=1)
    retrieval_precision_at_k: float = Field(ge=0, le=1)
    retrieval_mrr: float = Field(ge=0, le=1)
    grounding_pass_rate: float = Field(ge=0, le=1)
    question_quality_mean: float = Field(ge=0, le=1)
    chat_quality_mean: float = Field(default=0.8, ge=0, le=1)
    lesson_coherence_mean: float = Field(default=0.8, ge=0, le=1)
    instructional_usefulness_mean: float = Field(default=0.8, ge=0, le=1)
    lesson_question_relevance_mean: float = Field(default=0.8, ge=0, le=1)
    application_reasoning_mean: float = Field(default=0.8, ge=0, le=1)
    distractor_quality_mean: float = Field(default=0.8, ge=0, le=1)
    mcq_grading_correctness_mean: float = Field(default=0.95, ge=0, le=1)
    difficulty_appropriateness_mean: float = Field(default=0.75, ge=0, le=1)
    grading_expected_range_rate: float = Field(ge=0, le=1)
    grading_max_score_spread: float = Field(ge=0, le=1)


class EvaluationConfig(StrictModel):
    config_version: str
    thresholds: EvaluationThresholds
    baseline_regression_tolerance: float = Field(default=0.0, ge=0, le=1)

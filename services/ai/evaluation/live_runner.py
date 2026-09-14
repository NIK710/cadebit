from uuid import UUID, uuid5

from app.contracts import (
    GenerateRequest,
    GenerationTask,
    PracticeGradeRequest,
    PracticeQuestionRequest,
    SourceReference,
)
from app.openai_client import GenerationClient
from app.orchestration import (
    EmptyGroundingProvider,
    GenerationOrchestrator,
    GroundingResult,
    GroundingSource,
    RetrievalDiagnostics,
)
from app.practice import PracticeOrchestrator
from app.practice_client import PracticeClient

from .judge import EvaluationJudgeClient
from .models import GenerationCase, GenerationKind, GradingCase
from .reporting import TokenCounter

EVALUATION_NAMESPACE = UUID("30e29626-f22d-44bb-9e8d-c8713e0bf65b")


class StaticGroundingProvider:
    def __init__(self, case: GenerationCase) -> None:
        self._sources = tuple(
            GroundingSource(
                reference=SourceReference(
                    material_id=uuid5(
                        EVALUATION_NAMESPACE, f"{case.id}:material:{index}"
                    ),
                    material_title=source.material_title,
                    chunk_id=uuid5(EVALUATION_NAMESPACE, f"{case.id}:chunk:{index}"),
                    section=source.section,
                    excerpt=source.content[:1_000],
                ),
                content=source.content,
            )
            for index, source in enumerate(case.sources)
        )

    async def retrieve(self, request: GenerateRequest) -> GroundingResult:
        del request
        return GroundingResult(
            sources=self._sources,
            diagnostics=RetrievalDiagnostics(
                duration_ms=0,
                embedding_input_tokens=0,
                query_characters=0,
                context_characters=sum(len(source.content) for source in self._sources),
                result_count=len(self._sources),
                top_k=len(self._sources),
                top_similarity=1,
                lowest_similarity=1,
                topic_depth=0,
                embedding_model="evaluation-static-sources",
            ),
        )


async def run_generation_suite(
    *,
    cases: list[GenerationCase],
    generation_client: GenerationClient,
    practice_client: PracticeClient,
    judge_client: EvaluationJudgeClient,
) -> tuple[list[dict], dict[str, float], TokenCounter]:
    outputs: list[dict] = []
    grounding_passes = 0
    question_quality_scores: list[float] = []
    tokens = TokenCounter()
    for case in cases:
        grounding = StaticGroundingProvider(case)
        if case.kind is GenerationKind.GROUNDED_ANSWER:
            response = await GenerationOrchestrator(
                generation_client, grounding
            ).generate(
                GenerateRequest(
                    user_id="evaluation-user",
                    course_id=uuid5(EVALUATION_NAMESPACE, f"{case.id}:course"),
                    task=GenerationTask.ANSWER,
                    input=case.request,
                ),
                f"eval-{case.id}",
            )
            candidate = response.content
            subject_usage = response.usage
            subject_model = response.model
            subject_response_id = response.response_id
        else:
            response = await PracticeOrchestrator(
                practice_client, grounding
            ).generate_question(
                PracticeQuestionRequest(
                    user_id="evaluation-user",
                    course_id=uuid5(EVALUATION_NAMESPACE, f"{case.id}:course"),
                    topic_id=uuid5(EVALUATION_NAMESPACE, f"{case.id}:topic"),
                    difficulty=case.difficulty,
                ),
                f"eval-{case.id}",
            )
            candidate = (
                f"Question:\n{response.question}\n\n"
                f"Reference answer:\n{response.reference_answer}\n\n"
                f"Grading rubric:\n{response.grading_rubric}"
            )
            subject_usage = response.usage
            subject_model = response.model
            subject_response_id = response.response_id
        tokens.add(subject_usage)
        judgment = await judge_client.judge_generation(
            kind=case.kind,
            request=case.request,
            sources=[source.content for source in case.sources],
            output=candidate,
            expected_facts=case.expected_facts,
            forbidden_claims=case.forbidden_claims,
        )
        tokens.add(judgment.usage)
        grounding_passes += int(judgment.output.grounding_passed)
        if case.kind is GenerationKind.PRACTICE_QUESTION:
            question_quality_scores.append(judgment.output.quality_score)
        outputs.append(
            {
                "id": case.id,
                "dataset_version": case.dataset_version,
                "kind": case.kind,
                "request": case.request,
                "candidate_output": candidate,
                "subject_model": subject_model,
                "subject_response_id": subject_response_id,
                "subject_usage": subject_usage.model_dump() if subject_usage else None,
                "judge_model": judgment.model,
                "judge_response_id": judgment.response_id,
                "judge_usage": judgment.usage.model_dump() if judgment.usage else None,
                "judgment": judgment.output.model_dump(),
            }
        )
    if not question_quality_scores:
        raise ValueError(
            "The generation dataset must include a practice_question case."
        )
    aggregates = {
        "grounding_pass_rate": round(grounding_passes / len(cases), 6),
        "question_quality_mean": round(
            sum(question_quality_scores) / len(question_quality_scores), 6
        ),
    }
    return outputs, aggregates, tokens


async def run_grading_suite(
    *,
    cases: list[GradingCase],
    practice_client: PracticeClient,
) -> tuple[list[dict], dict[str, float], TokenCounter]:
    outputs: list[dict] = []
    cases_in_expected_range = 0
    maximum_spread = 0.0
    tokens = TokenCounter()
    orchestrator = PracticeOrchestrator(practice_client, EmptyGroundingProvider())
    for case in cases:
        repetitions = []
        scores = []
        for repetition in range(case.repeats):
            response = await orchestrator.grade_answer(
                PracticeGradeRequest(
                    user_id="evaluation-user",
                    course_id=uuid5(EVALUATION_NAMESPACE, f"{case.id}:course"),
                    topic_id=uuid5(EVALUATION_NAMESPACE, f"{case.id}:topic"),
                    question=case.question,
                    reference_answer=case.reference_answer,
                    grading_rubric=case.rubric,
                    student_answer=case.student_answer,
                    difficulty=case.difficulty,
                ),
                f"eval-{case.id}-{repetition}",
            )
            scores.append(response.score)
            tokens.add(response.usage)
            repetitions.append(
                {
                    "repetition": repetition + 1,
                    "score": response.score,
                    "correct": response.correct,
                    "feedback": response.feedback,
                    "strengths": response.strengths,
                    "gaps": response.gaps,
                    "model": response.model,
                    "response_id": response.response_id,
                    "usage": response.usage.model_dump() if response.usage else None,
                }
            )
        spread = max(scores) - min(scores)
        maximum_spread = max(maximum_spread, spread)
        in_range = all(
            case.expected_score_min <= score <= case.expected_score_max
            for score in scores
        )
        cases_in_expected_range += int(in_range)
        outputs.append(
            {
                "id": case.id,
                "dataset_version": case.dataset_version,
                "expected_score_range": [
                    case.expected_score_min,
                    case.expected_score_max,
                ],
                "mean_score": round(sum(scores) / len(scores), 6),
                "score_spread": round(spread, 6),
                "all_scores_in_expected_range": in_range,
                "repetitions": repetitions,
            }
        )
    return (
        outputs,
        {
            "grading_expected_range_rate": round(
                cases_in_expected_range / len(cases), 6
            ),
            "grading_max_score_spread": round(maximum_spread, 6),
        },
        tokens,
    )

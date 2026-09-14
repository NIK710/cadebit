import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from app.contracts import TokenUsage
from app.openai_client import ModelResponse
from app.practice_client import GeneratedQuestion, GradedAnswer, StructuredModelResponse
from evaluation.datasets import DatasetError, load_jsonl
from evaluation.live_runner import run_generation_suite, run_grading_suite
from evaluation.metrics import calculate_retrieval_metrics, macro_average
from evaluation.models import (
    EvaluationConfig,
    GenerationCase,
    GenerationKind,
    GradingCase,
    RetrievalCase,
)
from evaluation.reporting import evaluate_regression


def test_retrieval_metrics_measure_recall_precision_and_rank():
    first = calculate_retrieval_metrics(["noise", "relevant"], ["relevant"], 2)
    second = calculate_retrieval_metrics(["a", "b"], ["a", "b"], 2)

    assert first.recall_at_k == 1
    assert first.precision_at_k == 0.5
    assert first.reciprocal_rank == 0.5
    assert macro_average([first, second]) == {
        "retrieval_recall_at_k": 1,
        "retrieval_precision_at_k": 0.75,
        "retrieval_mrr": 0.75,
    }


def test_dataset_loader_rejects_mixed_versions(tmp_path: Path):
    path = tmp_path / "cases.jsonl"
    common = {
        "user": "user",
        "course": "course",
        "task": "answer",
        "query": "query",
        "query_embedding_axis": 0,
        "relevant_chunk_ids": ["chunk"],
        "k": 1,
    }
    path.write_text(
        "\n".join(
            json.dumps({"id": f"case_{index}", "dataset_version": version, **common})
            for index, version in enumerate(("v1", "v2"))
        ),
        encoding="utf-8",
    )

    with pytest.raises(DatasetError, match="one dataset_version"):
        load_jsonl(path, RetrievalCase)


def test_regression_checks_thresholds_and_baselines():
    config = EvaluationConfig.model_validate(
        {
            "config_version": "test",
            "thresholds": {
                "retrieval_recall_at_k": 0.9,
                "retrieval_precision_at_k": 0.8,
                "retrieval_mrr": 0.8,
                "grounding_pass_rate": 0.9,
                "question_quality_mean": 0.8,
                "grading_expected_range_rate": 0.9,
                "grading_max_score_spread": 0.2,
            },
            "baseline_regression_tolerance": 0.02,
        }
    )
    result = evaluate_regression(
        {"retrieval_recall_at_k": 0.87},
        config,
        {"schema_version": "baseline-v1", "aggregates": {"retrieval_recall_at_k": 1}},
    )

    assert result["passed"] is False
    assert len(result["failures"]) == 2


class StubGenerationClient:
    async def generate(self, request):
        del request
        return ModelResponse(
            response_id="generation-1",
            content="The posterior combines the prior and likelihood.",
            model="subject-model",
            usage=TokenUsage(input_tokens=10, output_tokens=5, total_tokens=15),
        )


class StubPracticeClient:
    def __init__(self, scores=None):
        self.scores = iter(scores or [0.5])

    async def generate_question(self, *, instructions, input):
        del instructions, input
        return StructuredModelResponse(
            response_id="question-1",
            output=GeneratedQuestion(
                question="What equation defines independence?",
                reference_answer="P(A and B) = P(A)P(B).",
                grading_rubric="Full credit states the equation; partial credit describes it.",
            ),
            model="subject-model",
            usage=TokenUsage(input_tokens=12, output_tokens=8, total_tokens=20),
        )

    async def grade_answer(self, *, instructions, input):
        del instructions, input
        score = next(self.scores)
        return StructuredModelResponse(
            response_id=f"grade-{score}",
            output=GradedAnswer(
                score=score,
                correct=score >= 0.9,
                feedback="Evaluated.",
                strengths=[],
                gaps=[],
            ),
            model="subject-model",
            usage=TokenUsage(input_tokens=20, output_tokens=5, total_tokens=25),
        )


class StubJudge:
    async def judge_generation(self, **arguments):
        del arguments
        return SimpleNamespace(
            response_id="judge-1",
            model="judge-model",
            usage=TokenUsage(input_tokens=20, output_tokens=10, total_tokens=30),
            output=SimpleNamespace(
                grounding_passed=True,
                quality_score=0.9,
                model_dump=lambda: {
                    "grounding_score": 1,
                    "quality_score": 0.9,
                    "grounding_passed": True,
                    "quality_passed": True,
                    "unsupported_claims": [],
                    "rationale": "Supported.",
                },
            ),
        )


def test_live_generation_stores_per_case_outputs_and_usage():
    cases = [
        GenerationCase(
            id="answer",
            dataset_version="v1",
            kind=GenerationKind.GROUNDED_ANSWER,
            request="Explain the update.",
            sources=[{"material_title": "Notes", "content": "Prior times likelihood."}],
            expected_facts=["Prior and likelihood"],
        ),
        GenerationCase(
            id="question",
            dataset_version="v1",
            kind=GenerationKind.PRACTICE_QUESTION,
            request="Ask about independence.",
            sources=[{"material_title": "Notes", "content": "P(A and B)=P(A)P(B)."}],
            expected_facts=["Independence equation"],
        ),
    ]
    outputs, aggregates, tokens = asyncio.run(
        run_generation_suite(
            cases=cases,
            generation_client=StubGenerationClient(),  # type: ignore[arg-type]
            practice_client=StubPracticeClient(),  # type: ignore[arg-type]
            judge_client=StubJudge(),  # type: ignore[arg-type]
        )
    )

    assert len(outputs) == 2
    assert outputs[1]["candidate_output"].startswith("Question:")
    assert aggregates == {"grounding_pass_rate": 1, "question_quality_mean": 0.9}
    assert tokens.total_tokens == 95


def test_grading_consistency_repeats_and_measures_score_spread():
    case = GradingCase(
        id="grading",
        dataset_version="v1",
        question="Question",
        reference_answer="Reference",
        rubric="Rubric",
        student_answer="Answer",
        expected_score_min=0.4,
        expected_score_max=0.7,
        repeats=3,
    )
    outputs, aggregates, tokens = asyncio.run(
        run_grading_suite(
            cases=[case],
            practice_client=StubPracticeClient([0.5, 0.6, 0.55]),  # type: ignore[arg-type]
        )
    )

    assert len(outputs[0]["repetitions"]) == 3
    assert aggregates == {
        "grading_expected_range_rate": 1,
        "grading_max_score_spread": 0.1,
    }
    assert tokens.total_tokens == 75

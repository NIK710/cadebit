import argparse
import asyncio
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

import asyncpg
from app.config import get_settings
from app.lesson import MICRO_LESSON_PROMPT_VERSION
from app.openai_client import GenerationClientError, OpenAIGenerationClient
from app.orchestration import GENERATION_PROMPT_VERSION
from app.practice import GRADING_PROMPT_VERSION, QUESTION_PROMPT_VERSION
from app.practice_client import OpenAIPracticeClient
from app.retrieval import RETRIEVAL_QUERY_VERSION

from .datasets import load_config, load_jsonl, read_json
from .judge import JUDGE_PROMPT_VERSION, EvaluationJudgeClient
from .live_runner import run_generation_suite, run_grading_suite
from .models import CorpusChunk, GenerationCase, GradingCase, RetrievalCase
from .reporting import (
    TokenCounter,
    build_report,
    evaluate_regression,
    git_provenance,
    write_report,
)
from .retrieval_runner import FIXTURE_EMBEDDING_MODEL, run_retrieval_suite

EVALUATION_ROOT = Path(__file__).resolve().parent
REPOSITORY_ROOT = next(
    (parent for parent in EVALUATION_ROOT.parents if (parent / ".git").exists()),
    EVALUATION_ROOT.parent,
)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run CadeBit AI evaluations.")
    parser.add_argument(
        "--suite",
        choices=("retrieval", "live", "all"),
        default="retrieval",
        help="retrieval is deterministic; live requires OPENAI_API_KEY.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=REPOSITORY_ROOT / "artifacts" / "evaluations",
        help="Output JSON file or directory.",
    )
    parser.add_argument(
        "--baseline",
        type=Path,
        help="Optional baseline JSON. Retrieval uses the checked-in baseline by default.",
    )
    parser.add_argument(
        "--fail-on-regression",
        action="store_true",
        help="Exit nonzero when a threshold or baseline gate fails.",
    )
    return parser.parse_args()


async def run(args: argparse.Namespace) -> tuple[dict, Path]:
    started_at = datetime.now(UTC)
    settings = get_settings()
    config = load_config(EVALUATION_ROOT / "config.json")
    cases: list[dict] = []
    aggregates: dict[str, float] = {}
    dataset_versions: dict[str, str] = {}
    token_counter = TokenCounter()

    if args.suite in {"retrieval", "all"}:
        database_url = os.getenv("EVAL_DATABASE_URL", "").strip()
        if not database_url:
            raise ValueError(
                "EVAL_DATABASE_URL is required for the deterministic retrieval suite."
            )
        corpus_version, corpus = load_jsonl(
            EVALUATION_ROOT / "datasets" / "retrieval_corpus_v1.jsonl",
            CorpusChunk,
        )
        retrieval_version, retrieval_cases = load_jsonl(
            EVALUATION_ROOT / "datasets" / "retrieval_v1.jsonl",
            RetrievalCase,
        )
        retrieval_outputs, retrieval_aggregates = await run_retrieval_suite(
            database_url, corpus, retrieval_cases
        )
        cases.extend({"suite": "retrieval", **case} for case in retrieval_outputs)
        aggregates.update(retrieval_aggregates)
        dataset_versions["retrieval"] = retrieval_version
        dataset_versions["retrieval_corpus"] = corpus_version

    judge_model = os.getenv("EVAL_JUDGE_MODEL", settings.openai_model).strip()
    if args.suite in {"live", "all"}:
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY is required for live evaluations.")
        generation_version, generation_cases = load_jsonl(
            EVALUATION_ROOT / "datasets" / "generation_v1.jsonl",
            GenerationCase,
        )
        grading_version, grading_cases = load_jsonl(
            EVALUATION_ROOT / "datasets" / "grading_v1.jsonl",
            GradingCase,
        )
        generation_client = OpenAIGenerationClient(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            timeout_seconds=settings.openai_timeout_seconds,
            max_retries=settings.openai_max_retries,
            max_output_tokens=settings.openai_max_output_tokens,
        )
        practice_client = OpenAIPracticeClient(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            timeout_seconds=settings.openai_timeout_seconds,
            max_retries=settings.openai_max_retries,
            max_output_tokens=settings.openai_max_output_tokens,
            lesson_max_output_tokens=settings.openai_lesson_max_output_tokens,
        )
        judge_client = EvaluationJudgeClient(
            api_key=settings.openai_api_key,
            model=judge_model,
            timeout_seconds=settings.openai_timeout_seconds,
            max_retries=settings.openai_max_retries,
            max_output_tokens=settings.openai_max_output_tokens,
        )
        try:
            (
                generation_outputs,
                generation_aggregates,
                generation_tokens,
            ) = await run_generation_suite(
                cases=generation_cases,
                generation_client=generation_client,
                practice_client=practice_client,
                judge_client=judge_client,
            )
            (
                grading_outputs,
                grading_aggregates,
                grading_tokens,
            ) = await run_grading_suite(
                cases=grading_cases,
                practice_client=practice_client,
            )
        finally:
            await generation_client.close()
            await practice_client.close()
            await judge_client.close()
        cases.extend({"suite": "generation", **case} for case in generation_outputs)
        cases.extend({"suite": "grading", **case} for case in grading_outputs)
        aggregates.update(generation_aggregates)
        aggregates.update(grading_aggregates)
        for counter in (generation_tokens, grading_tokens):
            token_counter.input_tokens += counter.input_tokens
            token_counter.output_tokens += counter.output_tokens
            token_counter.total_tokens += counter.total_tokens
        dataset_versions.update(
            {"generation": generation_version, "grading": grading_version}
        )

    baseline_path = args.baseline
    if baseline_path is None and args.suite in {"retrieval", "all"}:
        baseline_path = EVALUATION_ROOT / "baselines" / "retrieval_v1.json"
    baseline = read_json(baseline_path) if baseline_path else None
    regression = evaluate_regression(aggregates, config, baseline)
    provenance = {
        **git_provenance(REPOSITORY_ROOT),
        "config_version": config.config_version,
        "dataset_versions": dataset_versions,
        "embedding_model": (
            FIXTURE_EMBEDDING_MODEL
            if args.suite in {"retrieval", "all"}
            else "not-used-static-sources"
        ),
        "configured_embedding_model": settings.embedding_model,
        "generation_model": settings.openai_model,
        "judge_model": judge_model,
        "prompt_versions": {
            "retrieval_query": RETRIEVAL_QUERY_VERSION,
            "generation": GENERATION_PROMPT_VERSION,
            "practice_question": QUESTION_PROMPT_VERSION,
            "practice_grading": GRADING_PROMPT_VERSION,
            "micro_lesson": MICRO_LESSON_PROMPT_VERSION,
            "evaluation_judge": JUDGE_PROMPT_VERSION,
        },
        "thresholds": config.thresholds.model_dump(),
        "baseline": str(baseline_path) if baseline_path else None,
        "retrieval_fixture": {
            "minimum_similarity": -1,
            "pipeline_version": "evaluation-fixture-v1",
        },
    }
    report = build_report(
        suite=args.suite,
        started_at=started_at,
        provenance=provenance,
        cases=cases,
        aggregates=aggregates,
        token_usage=token_counter.as_dict(),
        regression=regression,
    )
    return report, write_report(report, args.output)


def main() -> int:
    args = parse_arguments()
    try:
        report, output = asyncio.run(run(args))
    except (
        OSError,
        RuntimeError,
        ValueError,
        GenerationClientError,
        asyncpg.PostgresError,
    ) as error:
        print(f"Evaluation failed: {error}", file=sys.stderr)
        return 2
    print(
        json.dumps(
            {
                "output": str(output),
                "aggregates": report["aggregates"],
                "regression": report["regression"],
            },
            indent=2,
            sort_keys=True,
        )
    )
    if args.fail_on_regression and not report["regression"]["passed"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

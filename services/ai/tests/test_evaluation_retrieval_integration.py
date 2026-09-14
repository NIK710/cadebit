import asyncio
import os
from pathlib import Path

import pytest
from evaluation.datasets import load_jsonl
from evaluation.models import CorpusChunk, RetrievalCase
from evaluation.retrieval_runner import run_retrieval_suite

DATABASE_URL = os.getenv("EVAL_DATABASE_URL")
EVALUATION_ROOT = Path(__file__).resolve().parents[1] / "evaluation"
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="EVAL_DATABASE_URL is required for deterministic retrieval evaluation.",
)


def test_fixture_retrieval_meets_the_checked_in_baseline():
    assert DATABASE_URL is not None
    _, corpus = load_jsonl(
        EVALUATION_ROOT / "datasets" / "retrieval_corpus_v1.jsonl", CorpusChunk
    )
    _, cases = load_jsonl(
        EVALUATION_ROOT / "datasets" / "retrieval_v1.jsonl", RetrievalCase
    )

    outputs, aggregates = asyncio.run(run_retrieval_suite(DATABASE_URL, corpus, cases))

    assert all(not case["cross_course_leak"] for case in outputs)
    assert aggregates == {
        "retrieval_recall_at_k": 1,
        "retrieval_precision_at_k": 1,
        "retrieval_mrr": 1,
    }

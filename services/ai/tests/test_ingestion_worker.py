import asyncio
from collections import deque
from datetime import timedelta
from uuid import uuid4

from app.ingestion.models import EmbeddedChunk, IngestionClaim
from app.ingestion.pipeline import IngestionWorker


def claim(attempt: int) -> IngestionClaim:
    return IngestionClaim(
        job_id=uuid4(),
        material_id=uuid4(),
        pipeline_version="test-v1",
        attempt=attempt,
        max_attempts=3,
        storage_key="materials/test/notes.txt",
        media_type="text/plain",
        title="Notes",
        original_filename="notes.txt",
    )


class RecoveringRepository:
    def __init__(self) -> None:
        first = claim(1)
        self.claims = deque([first, IngestionClaim(**{**first.__dict__, "attempt": 2})])
        self.failures: list[tuple[IngestionClaim, timedelta]] = []
        self.completed: list[list[EmbeddedChunk]] = []

    async def claim_next(self, pipeline_version, worker_id, lease_seconds):
        assert pipeline_version == "test-v1"
        assert worker_id == "worker-1"
        assert lease_seconds == 60
        return self.claims.popleft() if self.claims else None

    async def heartbeat(self, claim, worker_id):
        return True

    async def complete(self, claim, worker_id, chunks, embedding_model):
        assert claim.attempt == 2
        assert embedding_model == "test-embedding"
        self.completed.append(chunks)

    async def fail(self, claim, worker_id, message, retry_delay):
        assert "temporary embedding failure" in message
        self.failures.append((claim, retry_delay))


class StaticObjectStore:
    async def get_bytes(self, key: str) -> bytes:
        assert key == "materials/test/notes.txt"
        return b"A durable ingestion test document."


class FailOnceEmbeddingClient:
    model = "test-embedding"

    def __init__(self) -> None:
        self.calls = 0

    async def embed(self, inputs: list[str]) -> list[list[float]]:
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("temporary embedding failure")
        return [[0.1] * 1536 for _ in inputs]


def test_worker_recovers_failed_job_and_completes_retry():
    repository = RecoveringRepository()
    worker = IngestionWorker(
        repository=repository,
        object_store=StaticObjectStore(),
        embedding_client=FailOnceEmbeddingClient(),
        pipeline_version="test-v1",
        worker_id="worker-1",
        lease_seconds=60,
        retry_base_seconds=5,
    )

    assert asyncio.run(worker.run_once()) is True
    assert len(repository.failures) == 1
    assert repository.failures[0][1] == timedelta(seconds=5)

    assert asyncio.run(worker.run_once()) is True
    assert len(repository.completed) == 1
    assert repository.completed[0][0].chunk.position == 0
    assert len(repository.completed[0][0].embedding) == 1536

    assert asyncio.run(worker.run_once()) is False

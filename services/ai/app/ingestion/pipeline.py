import asyncio
import logging
from contextlib import suppress
from datetime import timedelta
from typing import Protocol

from .chunking import chunk_sections
from .embeddings import EmbeddingClient
from .models import EmbeddedChunk, IngestionClaim
from .parsing import parse_document
from .repository import IngestionRepository, LostLeaseError


class ObjectStore(Protocol):
    async def get_bytes(self, key: str) -> bytes: ...


class IngestionWorker:
    def __init__(
        self,
        *,
        repository: IngestionRepository,
        object_store: ObjectStore,
        embedding_client: EmbeddingClient,
        pipeline_version: str,
        worker_id: str,
        lease_seconds: int,
        retry_base_seconds: int,
    ) -> None:
        self._repository = repository
        self._object_store = object_store
        self._embedding_client = embedding_client
        self._pipeline_version = pipeline_version
        self._worker_id = worker_id
        self._lease_seconds = lease_seconds
        self._retry_base_seconds = retry_base_seconds
        self._logger = logging.getLogger("cadebit.ingestion")

    async def run_once(self) -> bool:
        claim = await self._repository.claim_next(
            self._pipeline_version,
            self._worker_id,
            self._lease_seconds,
        )
        if claim is None:
            return False

        stop_heartbeat = asyncio.Event()
        heartbeat = asyncio.create_task(self._heartbeat(claim, stop_heartbeat))
        try:
            data = await self._object_store.get_bytes(claim.storage_key)
            parsed = parse_document(data, claim.media_type)
            chunks = chunk_sections(parsed)
            embeddings = await self._embedding_client.embed(
                [chunk.content for chunk in chunks]
            )
            embedded_chunks = [
                EmbeddedChunk(chunk=chunk, embedding=embedding)
                for chunk, embedding in zip(chunks, embeddings, strict=True)
            ]
            await self._repository.complete(
                claim,
                self._worker_id,
                embedded_chunks,
                self._embedding_client.model,
            )
            self._logger.info(
                "material ingestion completed",
                extra={
                    "event": "ingestion.completed",
                    "material_id": str(claim.material_id),
                    "job_id": str(claim.job_id),
                    "attempt": claim.attempt,
                    "chunk_count": len(chunks),
                },
            )
        except LostLeaseError:
            self._logger.warning(
                "material ingestion lease lost",
                extra={"event": "ingestion.lease_lost", "job_id": str(claim.job_id)},
            )
        except Exception as error:
            delay_seconds = self._retry_base_seconds * (2 ** (claim.attempt - 1))
            try:
                await self._repository.fail(
                    claim,
                    self._worker_id,
                    str(error),
                    timedelta(seconds=delay_seconds),
                )
            except LostLeaseError:
                self._logger.warning(
                    "failed ingestion lease already reclaimed",
                    extra={
                        "event": "ingestion.failure_lease_lost",
                        "job_id": str(claim.job_id),
                    },
                )
            except Exception:
                self._logger.exception(
                    "could not persist ingestion failure",
                    extra={
                        "event": "ingestion.failure_persist_failed",
                        "job_id": str(claim.job_id),
                    },
                )
            self._logger.exception(
                "material ingestion failed",
                extra={
                    "event": "ingestion.failed",
                    "material_id": str(claim.material_id),
                    "job_id": str(claim.job_id),
                    "attempt": claim.attempt,
                },
            )
        finally:
            stop_heartbeat.set()
            heartbeat.cancel()
            with suppress(asyncio.CancelledError):
                await heartbeat
        return True

    async def _heartbeat(
        self, claim: IngestionClaim, stop_heartbeat: asyncio.Event
    ) -> None:
        interval = max(self._lease_seconds / 3, 1)
        while not stop_heartbeat.is_set():
            try:
                await asyncio.wait_for(stop_heartbeat.wait(), timeout=interval)
            except TimeoutError:
                try:
                    lease_held = await self._repository.heartbeat(
                        claim, self._worker_id
                    )
                except Exception:
                    self._logger.exception(
                        "ingestion heartbeat failed",
                        extra={
                            "event": "ingestion.heartbeat_failed",
                            "job_id": str(claim.job_id),
                        },
                    )
                    return
                if not lease_held:
                    self._logger.warning(
                        "ingestion heartbeat lost its lease",
                        extra={
                            "event": "ingestion.heartbeat_lease_lost",
                            "job_id": str(claim.job_id),
                        },
                    )
                    return

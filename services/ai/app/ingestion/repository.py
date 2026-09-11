import json
from datetime import timedelta
from typing import Protocol

import asyncpg

from .models import EmbeddedChunk, IngestionClaim


class LostLeaseError(Exception):
    pass


class IngestionRepository(Protocol):
    async def claim_next(
        self, pipeline_version: str, worker_id: str, lease_seconds: int
    ) -> IngestionClaim | None: ...

    async def heartbeat(self, claim: IngestionClaim, worker_id: str) -> bool: ...

    async def complete(
        self,
        claim: IngestionClaim,
        worker_id: str,
        chunks: list[EmbeddedChunk],
        embedding_model: str,
    ) -> None: ...

    async def fail(
        self,
        claim: IngestionClaim,
        worker_id: str,
        message: str,
        retry_delay: timedelta,
    ) -> None: ...


class PostgresIngestionRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def claim_next(
        self, pipeline_version: str, worker_id: str, lease_seconds: int
    ) -> IngestionClaim | None:
        async with self._pool.acquire() as connection, connection.transaction():
            row = await connection.fetchrow(
                """
                with candidate as (
                    select job.id, job.material_id, job.pipeline_version,
                           job.attempts, job.max_attempts, material.storage_key,
                           material.media_type, material.title,
                           material.original_filename
                    from material_ingestion_jobs job
                    join materials material on material.id = job.material_id
                    where job.pipeline_version = $1
                      and job.attempts < job.max_attempts
                      and (
                        (job.status in ('pending', 'retry') and job.available_at <= now())
                        or (
                          job.status = 'processing'
                          and job.locked_at < now() - make_interval(secs => $2)
                        )
                      )
                    order by job.available_at, job.created_at
                    for update of job skip locked
                    limit 1
                )
                update material_ingestion_jobs job
                set status = 'processing',
                    attempts = job.attempts + 1,
                    locked_at = now(),
                    locked_by = $3,
                    last_error = null,
                    updated_at = now()
                from candidate
                where job.id = candidate.id
                returning job.id, job.material_id, job.pipeline_version,
                          job.attempts, job.max_attempts, candidate.storage_key,
                          candidate.media_type, candidate.title,
                          candidate.original_filename
                """,
                pipeline_version,
                lease_seconds,
                worker_id,
            )
            if row is None:
                return None
            await connection.execute(
                """
                update materials
                set status = 'processing', failure_reason = null, updated_at = now()
                where id = $1
                """,
                row["material_id"],
            )
        return IngestionClaim(
            job_id=row["id"],
            material_id=row["material_id"],
            pipeline_version=row["pipeline_version"],
            attempt=row["attempts"],
            max_attempts=row["max_attempts"],
            storage_key=row["storage_key"],
            media_type=row["media_type"],
            title=row["title"],
            original_filename=row["original_filename"],
        )

    async def heartbeat(self, claim: IngestionClaim, worker_id: str) -> bool:
        result = await self._pool.execute(
            """
            update material_ingestion_jobs
            set locked_at = now(), updated_at = now()
            where id = $1 and status = 'processing'
              and locked_by = $2 and attempts = $3
            """,
            claim.job_id,
            worker_id,
            claim.attempt,
        )
        return result == "UPDATE 1"

    async def complete(
        self,
        claim: IngestionClaim,
        worker_id: str,
        chunks: list[EmbeddedChunk],
        embedding_model: str,
    ) -> None:
        async with self._pool.acquire() as connection, connection.transaction():
            await _require_lease(connection, claim, worker_id)
            await connection.execute(
                "delete from material_chunks where material_id = $1",
                claim.material_id,
            )
            await connection.executemany(
                """
                insert into material_chunks (
                    material_id, position, content, content_hash, page_number,
                    section, source_metadata, pipeline_version, embedding_model,
                    embedding
                ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10::vector)
                """,
                [
                    (
                        claim.material_id,
                        item.chunk.position,
                        item.chunk.content,
                        item.chunk.content_hash,
                        item.chunk.page_number,
                        item.chunk.section,
                        json.dumps(item.chunk.source_metadata),
                        claim.pipeline_version,
                        embedding_model,
                        _vector_literal(item.embedding),
                    )
                    for item in chunks
                ],
            )
            await connection.execute(
                """
                update materials
                set status = 'ready', failure_reason = null,
                    pipeline_version = $2, processed_at = now(), updated_at = now()
                where id = $1
                """,
                claim.material_id,
                claim.pipeline_version,
            )
            await connection.execute(
                """
                update material_ingestion_jobs
                set status = 'complete', locked_at = null, locked_by = null,
                    last_error = null, completed_at = now(), updated_at = now()
                where id = $1
                """,
                claim.job_id,
            )

    async def fail(
        self,
        claim: IngestionClaim,
        worker_id: str,
        message: str,
        retry_delay: timedelta,
    ) -> None:
        safe_message = " ".join(message.split())[:1_000] or "Ingestion failed."
        final_attempt = claim.attempt >= claim.max_attempts
        async with self._pool.acquire() as connection, connection.transaction():
            await _require_lease(connection, claim, worker_id)
            await connection.execute(
                """
                update material_ingestion_jobs
                set status = $2::material_ingestion_status,
                    available_at = now() + $3,
                    locked_at = null, locked_by = null, last_error = $4,
                    updated_at = now()
                where id = $1
                """,
                claim.job_id,
                "failed" if final_attempt else "retry",
                retry_delay,
                safe_message,
            )
            await connection.execute(
                """
                update materials
                set status = $2::material_status, failure_reason = $3,
                    updated_at = now()
                where id = $1
                """,
                claim.material_id,
                "failed" if final_attempt else "processing",
                safe_message if final_attempt else None,
            )


async def _require_lease(
    connection: asyncpg.Connection,
    claim: IngestionClaim,
    worker_id: str,
) -> None:
    row = await connection.fetchrow(
        """
        select id from material_ingestion_jobs
        where id = $1 and status = 'processing'
          and locked_by = $2 and attempts = $3
        for update
        """,
        claim.job_id,
        worker_id,
        claim.attempt,
    )
    if row is None:
        raise LostLeaseError(
            "The ingestion job lease is no longer owned by this worker."
        )


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(format(value, ".9g") for value in values) + "]"

import asyncio
import os
from datetime import timedelta
from uuid import uuid4

import asyncpg
import pytest
from app.ingestion.models import EmbeddedChunk, MaterialChunk
from app.ingestion.repository import LostLeaseError, PostgresIngestionRepository

DATABASE_URL = os.getenv("AI_INTEGRATION_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="AI_INTEGRATION_DATABASE_URL is required for repository integration tests.",
)


def test_expired_claim_is_recovered_and_stale_worker_is_fenced():
    asyncio.run(_exercise_recovery())


async def _exercise_recovery() -> None:
    assert DATABASE_URL is not None
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=2)
    user_id = f"ingestion-user-{uuid4()}"
    course_id = uuid4()
    material_id = uuid4()
    failed_material_id = uuid4()
    try:
        await pool.execute(
            """
            insert into users (id, name, email, email_verified, created_at, updated_at)
            values ($1, 'Ingestion User', $2, false, now(), now())
            """,
            user_id,
            f"{user_id}@cadebit.test",
        )
        await pool.execute(
            """
            insert into courses (id, name, description, type, owner_id)
            values ($1, 'Ingestion Course', '', 'independent', $2)
            """,
            course_id,
            user_id,
        )
        await pool.execute(
            """
            insert into course_memberships (course_id, user_id, role)
            values ($1, $2, 'admin')
            """,
            course_id,
            user_id,
        )
        await pool.execute(
            """
            insert into materials (
                id, owner_id, title, original_filename, media_type, byte_size,
                content_hash, storage_key, status
            ) values ($1, $2, 'Notes', 'notes.txt', 'text/plain', 5, $3, $4, 'uploaded')
            """,
            material_id,
            user_id,
            "a" * 64,
            f"tests/{material_id}",
        )
        await pool.execute(
            """
            insert into course_materials (course_id, material_id, attached_by_user_id)
            values ($1, $2, $3)
            """,
            course_id,
            material_id,
            user_id,
        )
        await pool.execute(
            """
            insert into material_ingestion_jobs (material_id, pipeline_version)
            values ($1, 'integration-v1')
            """,
            material_id,
        )
        await pool.execute(
            """
            insert into material_chunks (
                material_id, position, content, content_hash, source_metadata,
                pipeline_version, embedding_model, embedding
            ) values ($1, 0, 'Stale content', $2, '{}'::jsonb,
                      'old-pipeline', 'old-embedding', $3::vector)
            """,
            material_id,
            "c" * 64,
            "[" + ",".join(["0"] * 1536) + "]",
        )

        repository = PostgresIngestionRepository(pool)
        first_claim = await repository.claim_next("integration-v1", "worker-1", 30)
        assert first_claim is not None
        await pool.execute(
            """
            update material_ingestion_jobs
            set locked_at = now() - interval '60 seconds'
            where id = $1
            """,
            first_claim.job_id,
        )
        recovered_claim = await repository.claim_next("integration-v1", "worker-2", 30)
        assert recovered_claim is not None
        assert recovered_claim.attempt == 2

        with pytest.raises(LostLeaseError):
            await repository.complete(
                first_claim,
                "worker-1",
                [_embedded_chunk()],
                "integration-embedding",
            )

        await repository.fail(
            recovered_claim,
            "worker-2",
            "temporary failure",
            timedelta(seconds=1),
        )
        await pool.execute(
            "update material_ingestion_jobs set available_at = now() where id = $1",
            recovered_claim.job_id,
        )
        final_claim = await repository.claim_next("integration-v1", "worker-3", 30)
        assert final_claim is not None
        assert final_claim.attempt == 3
        await repository.complete(
            final_claim,
            "worker-3",
            [_embedded_chunk()],
            "integration-embedding",
        )

        state = await pool.fetchrow(
            """
            select material.status, material.pipeline_version,
                   job.status as job_status,
                   (select count(*) from material_chunks where material_id = material.id)
                       as chunk_count,
                   (select content from material_chunks where material_id = material.id)
                       as chunk_content
            from materials material
            join material_ingestion_jobs job on job.material_id = material.id
            where material.id = $1
            """,
            material_id,
        )
        assert state is not None
        assert state["status"] == "ready"
        assert state["pipeline_version"] == "integration-v1"
        assert state["job_status"] == "complete"
        assert state["chunk_count"] == 1
        assert state["chunk_content"] == "Recovered content"

        await pool.execute(
            """
            insert into materials (
                id, owner_id, title, original_filename, media_type, byte_size,
                content_hash, storage_key, status
            ) values ($1, $2, 'Broken notes', 'broken.txt', 'text/plain', 5,
                      $3, $4, 'uploaded')
            """,
            failed_material_id,
            user_id,
            "d" * 64,
            f"tests/{failed_material_id}",
        )
        await pool.execute(
            """
            insert into course_materials (course_id, material_id, attached_by_user_id)
            values ($1, $2, $3)
            """,
            course_id,
            failed_material_id,
            user_id,
        )
        await pool.execute(
            """
            insert into material_ingestion_jobs (
                material_id, pipeline_version, max_attempts
            ) values ($1, 'integration-v1', 1)
            """,
            failed_material_id,
        )
        failed_claim = await repository.claim_next("integration-v1", "worker-final", 30)
        assert failed_claim is not None
        assert failed_claim.material_id == failed_material_id
        await repository.fail(
            failed_claim,
            "worker-final",
            "permanent parsing failure",
            timedelta(seconds=1),
        )
        failed_state = await pool.fetchrow(
            """
            select material.status, material.failure_reason,
                   job.status as job_status, job.last_error
            from materials material
            join material_ingestion_jobs job on job.material_id = material.id
            where material.id = $1
            """,
            failed_material_id,
        )
        assert failed_state is not None
        assert failed_state["status"] == "failed"
        assert failed_state["job_status"] == "failed"
        assert failed_state["failure_reason"] == "permanent parsing failure"
        assert failed_state["last_error"] == "permanent parsing failure"
    finally:
        await pool.execute(
            "delete from materials where id = any($1::uuid[])",
            [material_id, failed_material_id],
        )
        await pool.execute("delete from courses where id = $1", course_id)
        await pool.execute("delete from users where id = $1", user_id)
        await pool.close()


def _embedded_chunk() -> EmbeddedChunk:
    return EmbeddedChunk(
        chunk=MaterialChunk(
            position=0,
            content="Recovered content",
            content_hash="b" * 64,
            page_number=1,
            section="Recovery",
            source_metadata={"test": True},
        ),
        embedding=[0.01] * 1536,
    )

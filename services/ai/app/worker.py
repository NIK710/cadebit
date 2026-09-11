import asyncio
import logging
import os
import socket
from uuid import uuid4

import asyncpg

from .config import get_settings
from .ingestion.embeddings import OpenAIEmbeddingClient
from .ingestion.pipeline import IngestionWorker
from .ingestion.repository import PostgresIngestionRepository
from .ingestion.storage import S3ObjectStore
from .observability import configure_logging


async def run() -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL is required by the ingestion worker.")
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required by the ingestion worker.")

    pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=3,
        command_timeout=30,
    )
    embedding_client = OpenAIEmbeddingClient(
        api_key=settings.openai_api_key,
        model=settings.embedding_model,
        timeout_seconds=settings.openai_timeout_seconds,
        max_retries=settings.openai_max_retries,
    )
    object_store = S3ObjectStore(
        endpoint=settings.s3_endpoint,
        region=settings.s3_region,
        bucket=settings.s3_bucket,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        force_path_style=settings.s3_force_path_style,
    )
    worker_id = f"{socket.gethostname()}:{os.getpid()}:{uuid4().hex[:8]}"
    worker = IngestionWorker(
        repository=PostgresIngestionRepository(pool),
        object_store=object_store,
        embedding_client=embedding_client,
        pipeline_version=settings.material_pipeline_version,
        worker_id=worker_id,
        lease_seconds=settings.worker_lease_seconds,
        retry_base_seconds=settings.worker_retry_base_seconds,
    )
    logging.getLogger("cadebit.ingestion").info(
        "ingestion worker started",
        extra={
            "event": "ingestion.worker_started",
            "worker_id": worker_id,
            "pipeline_version": settings.material_pipeline_version,
        },
    )
    try:
        while True:
            try:
                processed = await worker.run_once()
            except Exception:
                logging.getLogger("cadebit.ingestion").exception(
                    "ingestion worker iteration failed",
                    extra={"event": "ingestion.worker_iteration_failed"},
                )
                processed = False
            if not processed:
                await asyncio.sleep(settings.worker_poll_seconds)
    finally:
        await embedding_client.close()
        await pool.close()


def main() -> None:
    asyncio.run(run())


if __name__ == "__main__":
    main()

from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import asyncpg

from .authorization import (
    CourseAuthorizer,
    PostgresCourseAuthorizer,
    ServiceTokenVerifier,
    UnavailableCourseAuthorizer,
)
from .config import Settings
from .embeddings import OpenAIEmbeddingClient
from .openai_client import OpenAIGenerationClient, UnavailableGenerationClient
from .orchestration import EmptyGroundingProvider, GenerationOrchestrator
from .practice import PracticeOrchestrator
from .practice_client import OpenAIPracticeClient, UnavailablePracticeClient
from .retrieval import PostgresGroundingProvider


@dataclass
class ServiceContainer:
    token_verifier: ServiceTokenVerifier
    course_authorizer: CourseAuthorizer
    orchestrator: GenerationOrchestrator
    practice_orchestrator: PracticeOrchestrator | None = None
    close_callback: Callable[[], Awaitable[None]] | None = None

    async def close(self) -> None:
        if self.close_callback is not None:
            await self.close_callback()


async def build_service_container(settings: Settings) -> ServiceContainer:
    pool: asyncpg.Pool | None = None
    if settings.database_url:
        pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=5,
            command_timeout=10,
        )
        course_authorizer: CourseAuthorizer = PostgresCourseAuthorizer(pool)
    else:
        course_authorizer = UnavailableCourseAuthorizer()

    embedding_client: OpenAIEmbeddingClient | None = None
    if settings.openai_api_key:
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
        )
        if pool is not None:
            embedding_client = OpenAIEmbeddingClient(
                api_key=settings.openai_api_key,
                model=settings.embedding_model,
                timeout_seconds=settings.openai_timeout_seconds,
                max_retries=settings.openai_max_retries,
            )
            grounding_provider = PostgresGroundingProvider(
                pool,
                embedding_client,
                top_k=settings.rag_top_k,
                minimum_similarity=settings.rag_min_similarity,
                max_context_characters=settings.rag_max_context_characters,
            )
        else:
            grounding_provider = EmptyGroundingProvider()
    else:
        generation_client = UnavailableGenerationClient()
        practice_client = UnavailablePracticeClient()
        grounding_provider = EmptyGroundingProvider()

    async def close() -> None:
        if isinstance(generation_client, OpenAIGenerationClient):
            await generation_client.close()
        if isinstance(practice_client, OpenAIPracticeClient):
            await practice_client.close()
        if embedding_client is not None:
            await embedding_client.close()
        if pool is not None:
            await pool.close()

    return ServiceContainer(
        token_verifier=ServiceTokenVerifier(settings.service_token),
        course_authorizer=course_authorizer,
        orchestrator=GenerationOrchestrator(
            generation_client,
            grounding_provider,
        ),
        practice_orchestrator=PracticeOrchestrator(
            practice_client,
            grounding_provider,
        ),
        close_callback=close,
    )

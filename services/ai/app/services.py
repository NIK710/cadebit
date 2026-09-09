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
from .openai_client import OpenAIGenerationClient, UnavailableGenerationClient
from .orchestration import EmptyGroundingProvider, GenerationOrchestrator


@dataclass
class ServiceContainer:
    token_verifier: ServiceTokenVerifier
    course_authorizer: CourseAuthorizer
    orchestrator: GenerationOrchestrator
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

    if settings.openai_api_key:
        generation_client = OpenAIGenerationClient(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            timeout_seconds=settings.openai_timeout_seconds,
            max_retries=settings.openai_max_retries,
            max_output_tokens=settings.openai_max_output_tokens,
        )
    else:
        generation_client = UnavailableGenerationClient()

    async def close() -> None:
        if isinstance(generation_client, OpenAIGenerationClient):
            await generation_client.close()
        if pool is not None:
            await pool.close()

    return ServiceContainer(
        token_verifier=ServiceTokenVerifier(settings.service_token),
        course_authorizer=course_authorizer,
        orchestrator=GenerationOrchestrator(
            generation_client,
            EmptyGroundingProvider(),
        ),
        close_callback=close,
    )

import hmac
from typing import Protocol
from uuid import UUID

import asyncpg


class ServiceAuthenticationError(Exception):
    pass


class ServiceAuthenticationUnavailableError(Exception):
    pass


class CourseAccessDeniedError(Exception):
    pass


class CourseAuthorizationUnavailableError(Exception):
    pass


class ServiceTokenVerifier:
    def __init__(self, expected_token: str | None) -> None:
        self._expected_token = expected_token

    def verify(self, authorization_header: str | None) -> None:
        if self._expected_token is None:
            raise ServiceAuthenticationUnavailableError(
                "AI_SERVICE_TOKEN is not configured."
            )
        if not authorization_header or not authorization_header.startswith("Bearer "):
            raise ServiceAuthenticationError("A bearer service token is required.")
        provided_token = authorization_header.removeprefix("Bearer ").strip()
        if not provided_token or not hmac.compare_digest(
            provided_token, self._expected_token
        ):
            raise ServiceAuthenticationError("The service token is invalid.")


class CourseAuthorizer(Protocol):
    async def require_access(self, user_id: str, course_id: UUID) -> None: ...


class PostgresCourseAuthorizer:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def require_access(self, user_id: str, course_id: UUID) -> None:
        try:
            membership_exists = await self._pool.fetchval(
                """
                select exists (
                    select 1
                    from course_memberships
                    where user_id = $1 and course_id = $2
                )
                """,
                user_id,
                course_id,
            )
        except (asyncpg.PostgresError, OSError, TimeoutError) as error:
            raise CourseAuthorizationUnavailableError(
                "Course authorization is temporarily unavailable."
            ) from error

        if not membership_exists:
            raise CourseAccessDeniedError("The user cannot access this course.")


class UnavailableCourseAuthorizer:
    async def require_access(self, user_id: str, course_id: UUID) -> None:
        del user_id, course_id
        raise CourseAuthorizationUnavailableError(
            "Course authorization is unavailable because DATABASE_URL is not configured."
        )

import asyncio
from uuid import uuid4

import pytest
from app.authorization import (
    CourseAccessDeniedError,
    CourseAuthorizationUnavailableError,
    PostgresCourseAuthorizer,
    ServiceAuthenticationError,
    ServiceAuthenticationUnavailableError,
    ServiceTokenVerifier,
)


class FakePool:
    def __init__(self, membership_exists: bool) -> None:
        self.membership_exists = membership_exists
        self.arguments: tuple[object, ...] | None = None

    async def fetchval(self, query: str, *arguments: object) -> bool:
        assert "course_memberships" in query
        self.arguments = arguments
        return self.membership_exists


class TimedOutPool:
    async def fetchval(self, query: str, *arguments: object) -> bool:
        del query, arguments
        raise TimeoutError


def test_service_token_verifier_accepts_matching_bearer_token():
    ServiceTokenVerifier("secret").verify("Bearer secret")


@pytest.mark.parametrize("header", [None, "", "Basic secret", "Bearer wrong"])
def test_service_token_verifier_rejects_invalid_header(header: str | None):
    with pytest.raises(ServiceAuthenticationError):
        ServiceTokenVerifier("secret").verify(header)


def test_service_token_verifier_requires_configuration():
    with pytest.raises(ServiceAuthenticationUnavailableError):
        ServiceTokenVerifier(None).verify("Bearer secret")


def test_course_authorizer_checks_user_and_course_membership():
    course_id = uuid4()
    pool = FakePool(True)

    asyncio.run(PostgresCourseAuthorizer(pool).require_access("user-1", course_id))  # type: ignore[arg-type]

    assert pool.arguments == ("user-1", course_id)


def test_course_authorizer_denies_non_member():
    pool = FakePool(False)

    with pytest.raises(CourseAccessDeniedError):
        asyncio.run(
            PostgresCourseAuthorizer(pool).require_access("user-1", uuid4())  # type: ignore[arg-type]
        )


def test_course_authorizer_maps_database_timeout():
    with pytest.raises(CourseAuthorizationUnavailableError):
        asyncio.run(
            PostgresCourseAuthorizer(TimedOutPool()).require_access(  # type: ignore[arg-type]
                "user-1", uuid4()
            )
        )

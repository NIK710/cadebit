import asyncio
import os
from uuid import uuid4

import asyncpg
import pytest
from app.authorization import CourseAccessDeniedError
from app.contracts import GenerateRequest, GenerationTask
from app.embeddings import QueryEmbedding
from app.retrieval import InvalidTopicScopeError, PostgresGroundingProvider

DATABASE_URL = os.getenv("AI_INTEGRATION_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not DATABASE_URL,
    reason="AI_INTEGRATION_DATABASE_URL is required for retrieval integration tests.",
)


class TopicAwareEmbeddingClient:
    model = "integration-embedding"

    def __init__(self) -> None:
        self.queries: list[str] = []

    async def embed_query(self, text: str) -> QueryEmbedding:
        self.queries.append(text)
        if "Topic hierarchy: Probability > Bayes Rule" in text:
            return QueryEmbedding(vector=_axis_vector(0), input_tokens=18)
        return QueryEmbedding(vector=_axis_vector(1), input_tokens=12)


def test_retrieval_is_course_isolated_and_topic_aware():
    asyncio.run(_exercise_retrieval())


async def _exercise_retrieval() -> None:
    assert DATABASE_URL is not None
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=2)
    first_user = f"retrieval-a-{uuid4()}"
    second_user = f"retrieval-b-{uuid4()}"
    first_course = uuid4()
    second_course = uuid4()
    parent_topic = uuid4()
    child_topic = uuid4()
    foreign_topic = uuid4()
    first_material = uuid4()
    second_material = uuid4()
    try:
        await pool.executemany(
            """
            insert into users (id, name, email, email_verified, created_at, updated_at)
            values ($1, $2, $3, false, now(), now())
            """,
            [
                (first_user, "Retrieval A", f"{first_user}@cadebit.test"),
                (second_user, "Retrieval B", f"{second_user}@cadebit.test"),
            ],
        )
        await pool.executemany(
            """
            insert into courses (id, name, description, type, owner_id)
            values ($1, $2, '', 'independent', $3)
            """,
            [
                (first_course, "Probability Course", first_user),
                (second_course, "Private Course", second_user),
            ],
        )
        await pool.executemany(
            """
            insert into course_memberships (course_id, user_id, role)
            values ($1, $2, 'admin')
            """,
            [(first_course, first_user), (second_course, second_user)],
        )
        await pool.execute(
            """
            insert into topics (id, course_id, parent_id, name, position)
            values ($1, $2, null, 'Probability', 0),
                   ($3, $2, $1, 'Bayes Rule', 0),
                   ($4, $5, null, 'Private Topic', 0)
            """,
            parent_topic,
            first_course,
            child_topic,
            foreign_topic,
            second_course,
        )
        await pool.executemany(
            """
            insert into materials (
                id, owner_id, title, original_filename, media_type, byte_size,
                content_hash, storage_key, status, pipeline_version, processed_at
            ) values ($1, $2, $3, 'notes.txt', 'text/plain', 100, $4, $5,
                      'ready', 'retrieval-v1', now())
            """,
            [
                (
                    first_material,
                    first_user,
                    "Probability Notes",
                    "a" * 64,
                    f"tests/{first_material}",
                ),
                (
                    second_material,
                    second_user,
                    "Private Notes",
                    "b" * 64,
                    f"tests/{second_material}",
                ),
            ],
        )
        await pool.executemany(
            """
            insert into course_materials (course_id, material_id, attached_by_user_id)
            values ($1, $2, $3)
            """,
            [
                (first_course, first_material, first_user),
                (second_course, second_material, second_user),
            ],
        )
        await pool.executemany(
            """
            insert into material_chunks (
                material_id, position, content, content_hash, source_metadata,
                pipeline_version, embedding_model, embedding, section
            ) values ($1, $2, $3, $4, '{}'::jsonb, 'retrieval-v1',
                      'integration-embedding', $5::vector, $6)
            """,
            [
                (
                    first_material,
                    0,
                    "Bayes theorem updates prior probability with evidence.",
                    "c" * 64,
                    _vector_literal(_axis_vector(0)),
                    "Bayes Rule",
                ),
                (
                    first_material,
                    1,
                    "The course includes general administrative information.",
                    "d" * 64,
                    _vector_literal(_axis_vector(1)),
                    "Overview",
                ),
                (
                    second_material,
                    0,
                    "Private perfect-match content must never cross courses.",
                    "e" * 64,
                    _vector_literal(_axis_vector(0)),
                    "Private Topic",
                ),
            ],
        )

        embedding_client = TopicAwareEmbeddingClient()
        provider = PostgresGroundingProvider(
            pool,
            embedding_client,  # type: ignore[arg-type]
            top_k=5,
            minimum_similarity=-1,
            max_context_characters=10_000,
        )
        scoped = await provider.retrieve(
            _request(first_user, first_course, child_topic)
        )
        assert scoped.sources[0].reference.section == "Bayes Rule"
        assert all(
            source.reference.material_id == first_material for source in scoped.sources
        )
        assert scoped.diagnostics.topic_depth == 2
        assert scoped.diagnostics.embedding_input_tokens == 18
        assert (
            "Topic hierarchy: Probability > Bayes Rule" in embedding_client.queries[-1]
        )

        unscoped = await provider.retrieve(_request(first_user, first_course))
        assert unscoped.sources[0].reference.section == "Overview"
        assert "Topic hierarchy:" not in embedding_client.queries[-1]

        with pytest.raises(InvalidTopicScopeError):
            await provider.retrieve(_request(first_user, first_course, foreign_topic))
        with pytest.raises(CourseAccessDeniedError):
            await provider.retrieve(_request(second_user, first_course))
    finally:
        await pool.execute(
            "delete from materials where id = any($1::uuid[])",
            [first_material, second_material],
        )
        await pool.execute(
            "delete from courses where id = any($1::uuid[])",
            [first_course, second_course],
        )
        await pool.execute(
            "delete from users where id = any($1::text[])",
            [first_user, second_user],
        )
        await pool.close()


def _request(user_id: str, course_id, topic_id=None) -> GenerateRequest:
    return GenerateRequest(
        user_id=user_id,
        course_id=course_id,
        topic_id=topic_id,
        task=GenerationTask.ANSWER,
        input="Explain the relevant concept.",
    )


def _axis_vector(index: int) -> list[float]:
    values = [0.0] * 1536
    values[index] = 1.0
    return values


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(str(value) for value in values) + "]"

from dataclasses import asdict
from uuid import UUID, uuid4, uuid5

import asyncpg
from app.contracts import GenerateRequest, GenerationTask
from app.embeddings import QueryEmbedding
from app.retrieval import PostgresGroundingProvider

from .metrics import RetrievalMetrics, calculate_retrieval_metrics, macro_average
from .models import CorpusChunk, RetrievalCase

FIXTURE_EMBEDDING_MODEL = "evaluation-fixture-embedding-v1"
FIXTURE_PIPELINE_VERSION = "evaluation-fixture-v1"


class FixtureEmbeddingClient:
    model = FIXTURE_EMBEDDING_MODEL

    def __init__(self, cases: list[RetrievalCase]) -> None:
        self._cases = cases

    async def embed_query(self, text: str) -> QueryEmbedding:
        matches = [case for case in self._cases if case.query in text]
        if len(matches) != 1:
            raise ValueError("Fixture query did not match exactly one retrieval case.")
        return QueryEmbedding(
            vector=_axis_vector(matches[0].query_embedding_axis),
            input_tokens=0,
        )


async def run_retrieval_suite(
    database_url: str,
    corpus: list[CorpusChunk],
    cases: list[RetrievalCase],
) -> tuple[list[dict], dict[str, float]]:
    pool = await asyncpg.create_pool(database_url, min_size=1, max_size=2)
    fixture = RetrievalFixture(uuid4())
    try:
        await fixture.seed(pool, corpus, cases)
        embedding_client = FixtureEmbeddingClient(cases)
        case_outputs: list[dict] = []
        metric_rows: list[RetrievalMetrics] = []
        for case in cases:
            provider = PostgresGroundingProvider(
                pool,
                embedding_client,  # type: ignore[arg-type]
                top_k=case.k,
                minimum_similarity=-1,
                max_context_characters=50_000,
            )
            result = await provider.retrieve(
                GenerateRequest(
                    user_id=fixture.user_ids[case.user],
                    course_id=fixture.course_ids[case.course],
                    topic_id=(fixture.topic_ids[case.topic] if case.topic else None),
                    task=GenerationTask(case.task),
                    input=case.query,
                )
            )
            retrieved_ids = [
                fixture.chunk_labels[source.reference.chunk_id]
                for source in result.sources
                if source.reference.chunk_id is not None
            ]
            cross_course_leak = any(
                fixture.chunk_courses[identifier] != case.course
                for identifier in retrieved_ids
            )
            metrics = calculate_retrieval_metrics(
                retrieved_ids, case.relevant_chunk_ids, case.k
            )
            metric_rows.append(metrics)
            case_outputs.append(
                {
                    "id": case.id,
                    "dataset_version": case.dataset_version,
                    "query": case.query,
                    "k": case.k,
                    "expected_chunk_ids": case.relevant_chunk_ids,
                    "retrieved_chunk_ids": retrieved_ids,
                    "cross_course_leak": cross_course_leak,
                    "metrics": asdict(metrics),
                    "retrieval_diagnostics": asdict(result.diagnostics),
                }
            )
        return case_outputs, macro_average(metric_rows)
    finally:
        await fixture.cleanup(pool)
        await pool.close()


class RetrievalFixture:
    def __init__(self, namespace: UUID) -> None:
        self.namespace = namespace
        self.user_ids: dict[str, str] = {}
        self.course_ids: dict[str, UUID] = {}
        self.material_ids: dict[str, UUID] = {}
        self.topic_ids: dict[str, UUID] = {}
        self.chunk_ids: dict[str, UUID] = {}
        self.chunk_labels: dict[UUID, str] = {}
        self.chunk_courses: dict[str, str] = {}

    def identifier(self, kind: str, label: str) -> UUID:
        return uuid5(self.namespace, f"{kind}:{label}")

    async def seed(
        self,
        pool: asyncpg.Pool,
        corpus: list[CorpusChunk],
        cases: list[RetrievalCase],
    ) -> None:
        owners = sorted({chunk.owner for chunk in corpus})
        for owner in owners:
            self.user_ids[owner] = f"eval-{self.namespace}-{owner}"
        courses = sorted({chunk.course for chunk in corpus})
        for course in courses:
            self.course_ids[course] = self.identifier("course", course)
        materials = sorted({chunk.material for chunk in corpus})
        for material in materials:
            self.material_ids[material] = self.identifier("material", material)
        for chunk in corpus:
            chunk_id = self.identifier("chunk", chunk.id)
            self.chunk_ids[chunk.id] = chunk_id
            self.chunk_labels[chunk_id] = chunk.id
            self.chunk_courses[chunk.id] = chunk.course

        async with pool.acquire() as connection:
            async with connection.transaction():
                await connection.executemany(
                    """
                    insert into users (id, name, email, email_verified, created_at, updated_at)
                    values ($1, $2, $3, false, now(), now())
                    """,
                    [
                        (
                            self.user_ids[owner],
                            f"Evaluation {owner}",
                            f"{self.user_ids[owner]}@cadebit.test",
                        )
                        for owner in owners
                    ],
                )
                course_owner = {
                    course: next(
                        chunk.owner for chunk in corpus if chunk.course == course
                    )
                    for course in courses
                }
                await connection.executemany(
                    """
                    insert into courses (id, name, description, type, owner_id)
                    values ($1, $2, '', 'independent', $3)
                    """,
                    [
                        (
                            self.course_ids[course],
                            course.replace("_", " ").title(),
                            self.user_ids[course_owner[course]],
                        )
                        for course in courses
                    ],
                )
                await connection.executemany(
                    """
                    insert into course_memberships (course_id, user_id, role)
                    values ($1, $2, 'admin')
                    """,
                    [
                        (
                            self.course_ids[course],
                            self.user_ids[course_owner[course]],
                        )
                        for course in courses
                    ],
                )
                await self._seed_topics(connection, cases)
                material_rows = []
                for material in materials:
                    example = next(
                        chunk for chunk in corpus if chunk.material == material
                    )
                    material_rows.append(
                        (
                            self.material_ids[material],
                            self.user_ids[example.owner],
                            example.material_title,
                            f"{material}.txt",
                            "text/plain",
                            len(example.content.encode()),
                            self.identifier("hash", material).hex * 2,
                            f"evaluations/{self.namespace}/{material}",
                            FIXTURE_PIPELINE_VERSION,
                        )
                    )
                await connection.executemany(
                    """
                    insert into materials (
                        id, owner_id, title, original_filename, media_type, byte_size,
                        content_hash, storage_key, status, pipeline_version, processed_at
                    ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'ready', $9, now())
                    """,
                    material_rows,
                )
                await connection.executemany(
                    """
                    insert into course_materials (course_id, material_id, attached_by_user_id)
                    values ($1, $2, $3)
                    """,
                    [
                        (
                            self.course_ids[chunk.course],
                            self.material_ids[chunk.material],
                            self.user_ids[chunk.owner],
                        )
                        for chunk in _unique_material_chunks(corpus)
                    ],
                )
                await connection.executemany(
                    """
                    insert into material_chunks (
                        id, material_id, position, content, content_hash, source_metadata,
                        pipeline_version, embedding_model, embedding, section
                    ) values ($1, $2, $3, $4, $5, '{}'::jsonb, $6, $7, $8::vector, $9)
                    """,
                    [
                        (
                            self.chunk_ids[chunk.id],
                            self.material_ids[chunk.material],
                            position,
                            chunk.content,
                            self.identifier("chunk-hash", chunk.id).hex * 2,
                            FIXTURE_PIPELINE_VERSION,
                            FIXTURE_EMBEDDING_MODEL,
                            _vector_literal(_axis_vector(chunk.embedding_axis)),
                            chunk.section,
                        )
                        for position, chunk in enumerate(corpus)
                    ],
                )

    async def _seed_topics(
        self, connection: asyncpg.Connection, cases: list[RetrievalCase]
    ) -> None:
        created_paths: dict[tuple[str, ...], UUID] = {}
        sibling_positions: dict[tuple[str, UUID | None], int] = {}
        for case in cases:
            parent_id = None
            accumulated: list[str] = []
            for name in case.topic_path:
                accumulated.append(f"{case.course}:{name}")
                path_key = tuple(accumulated)
                topic_id = created_paths.get(path_key)
                if topic_id is None:
                    topic_id = self.identifier("topic", ">".join(path_key))
                    sibling_key = (case.course, parent_id)
                    position = sibling_positions.get(sibling_key, 0)
                    sibling_positions[sibling_key] = position + 1
                    await connection.execute(
                        """
                        insert into topics (id, course_id, parent_id, name, position)
                        values ($1, $2, $3, $4, $5)
                        """,
                        topic_id,
                        self.course_ids[case.course],
                        parent_id,
                        name,
                        position,
                    )
                    created_paths[path_key] = topic_id
                parent_id = topic_id
            if case.topic:
                if parent_id is None:
                    raise ValueError(
                        f"Retrieval case {case.id} has a topic without a path."
                    )
                self.topic_ids[case.topic] = parent_id

    async def cleanup(self, pool: asyncpg.Pool) -> None:
        if not self.course_ids:
            return
        async with pool.acquire() as connection:
            await connection.execute(
                "delete from materials where id = any($1::uuid[])",
                list(self.material_ids.values()),
            )
            await connection.execute(
                "delete from courses where id = any($1::uuid[])",
                list(self.course_ids.values()),
            )
            await connection.execute(
                "delete from users where id = any($1::text[])",
                list(self.user_ids.values()),
            )


def _unique_material_chunks(corpus: list[CorpusChunk]) -> list[CorpusChunk]:
    unique: dict[tuple[str, str], CorpusChunk] = {}
    for chunk in corpus:
        unique.setdefault((chunk.course, chunk.material), chunk)
    return list(unique.values())


def _axis_vector(index: int) -> list[float]:
    values = [0.0] * 1536
    values[index] = 1.0
    return values


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(format(value, ".9g") for value in values) + "]"

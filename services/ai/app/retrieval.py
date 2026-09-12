import logging
import re
from time import perf_counter

import asyncpg

from .authorization import CourseAccessDeniedError
from .contracts import GenerateRequest, GenerationTask, SourceReference
from .embeddings import EmbeddingClient
from .orchestration import (
    GroundingResult,
    GroundingSource,
    RetrievalDiagnostics,
)


class InvalidTopicScopeError(Exception):
    pass


class RetrievalUnavailableError(Exception):
    pass


class PostgresGroundingProvider:
    def __init__(
        self,
        pool: asyncpg.Pool,
        embedding_client: EmbeddingClient,
        *,
        top_k: int,
        minimum_similarity: float,
        max_context_characters: int,
    ) -> None:
        self._pool = pool
        self._embedding_client = embedding_client
        self._top_k = top_k
        self._minimum_similarity = minimum_similarity
        self._max_context_characters = max_context_characters
        self._logger = logging.getLogger("cadebit.retrieval")

    async def retrieve(self, request: GenerateRequest) -> GroundingResult:
        started_at = perf_counter()
        try:
            course_name = await self._load_authorized_course_name(request)
            topic_path = await self._load_topic_path(request)
            semantic_query = build_semantic_query(
                course_name=course_name,
                topic_path=topic_path,
                task=request.task,
                student_input=request.input,
            )
            query_embedding = await self._embedding_client.embed_query(semantic_query)
            rows = await self._retrieve_rows(request, query_embedding.vector)
        except (InvalidTopicScopeError, CourseAccessDeniedError):
            raise
        except (asyncpg.PostgresError, OSError, TimeoutError) as error:
            raise RetrievalUnavailableError(
                "Course material retrieval is temporarily unavailable."
            ) from error

        selected: list[GroundingSource] = []
        similarities: list[float] = []
        context_characters = 0
        for row in rows:
            similarity = float(row["similarity"])
            if similarity < self._minimum_similarity:
                continue
            remaining = self._max_context_characters - context_characters
            if remaining <= 0:
                break
            content = str(row["content"])[:remaining]
            if not content:
                continue
            selected.append(
                GroundingSource(
                    reference=SourceReference(
                        material_id=row["material_id"],
                        material_title=_bounded_text(
                            row["material_title"], 500, "Course material"
                        ),
                        chunk_id=row["chunk_id"],
                        page_number=row["page_number"],
                        section=(
                            _bounded_text(row["section"], 500)
                            if row["section"] is not None
                            else None
                        ),
                        excerpt=_excerpt(content),
                    ),
                    content=content,
                )
            )
            similarities.append(similarity)
            context_characters += len(content)

        diagnostics = RetrievalDiagnostics(
            duration_ms=round((perf_counter() - started_at) * 1_000, 2),
            embedding_input_tokens=query_embedding.input_tokens,
            query_characters=len(semantic_query),
            context_characters=context_characters,
            result_count=len(selected),
            top_k=self._top_k,
            top_similarity=similarities[0] if similarities else None,
            lowest_similarity=similarities[-1] if similarities else None,
            topic_depth=len(topic_path),
            embedding_model=self._embedding_client.model,
        )
        self._logger.info(
            "course material retrieval completed",
            extra={
                "event": "retrieval.completed",
                "course_id": str(request.course_id),
                "topic_id": str(request.topic_id) if request.topic_id else None,
                "duration_ms": diagnostics.duration_ms,
                "embedding_input_tokens": diagnostics.embedding_input_tokens,
                "query_characters": diagnostics.query_characters,
                "context_characters": diagnostics.context_characters,
                "result_count": diagnostics.result_count,
                "top_k": diagnostics.top_k,
                "top_similarity": diagnostics.top_similarity,
                "lowest_similarity": diagnostics.lowest_similarity,
                "topic_depth": diagnostics.topic_depth,
                "embedding_model": diagnostics.embedding_model,
            },
        )
        return GroundingResult(sources=tuple(selected), diagnostics=diagnostics)

    async def _load_authorized_course_name(self, request: GenerateRequest) -> str:
        course_name = await self._pool.fetchval(
            """
            select course.name
            from course_memberships membership
            join courses course on course.id = membership.course_id
            where membership.user_id = $1 and membership.course_id = $2
            """,
            request.user_id,
            request.course_id,
        )
        if course_name is None:
            raise CourseAccessDeniedError("The user cannot access this course.")
        return str(course_name)

    async def _load_topic_path(self, request: GenerateRequest) -> tuple[str, ...]:
        if request.topic_id is None:
            return ()
        rows = await self._pool.fetch(
            """
            with recursive topic_path as (
                select topic.id, topic.parent_id, topic.name, 0 as depth
                from course_memberships membership
                join topics topic on topic.course_id = membership.course_id
                where membership.user_id = $1
                  and membership.course_id = $2
                  and topic.id = $3
                union all
                select parent.id, parent.parent_id, parent.name, child.depth + 1
                from topics parent
                join topic_path child on child.parent_id = parent.id
                where parent.course_id = $2
            )
            select name from topic_path order by depth desc
            """,
            request.user_id,
            request.course_id,
            request.topic_id,
        )
        if not rows:
            raise InvalidTopicScopeError(
                "The selected topic does not belong to this course."
            )
        return tuple(str(row["name"]) for row in rows)

    async def _retrieve_rows(
        self, request: GenerateRequest, query_embedding: list[float]
    ) -> list[asyncpg.Record]:
        return await self._pool.fetch(
            """
            select chunk.id as chunk_id,
                   material.id as material_id,
                   material.title as material_title,
                   chunk.content,
                   chunk.page_number,
                   chunk.section,
                   1 - (chunk.embedding <=> $3::vector) as similarity
            from course_memberships membership
            join course_materials course_material
              on course_material.course_id = membership.course_id
            join materials material
              on material.id = course_material.material_id
             and material.status = 'ready'
            join material_chunks chunk
              on chunk.material_id = material.id
             and chunk.pipeline_version = material.pipeline_version
             and chunk.embedding_model = $4
            where membership.user_id = $1
              and membership.course_id = $2
            order by chunk.embedding <=> $3::vector, chunk.id
            limit $5
            """,
            request.user_id,
            request.course_id,
            _vector_literal(query_embedding),
            self._embedding_client.model,
            self._top_k,
        )


def build_semantic_query(
    *,
    course_name: str,
    topic_path: tuple[str, ...],
    task: GenerationTask,
    student_input: str,
) -> str:
    parts = [f"Course: {course_name}"]
    if topic_path:
        parts.append(f"Topic hierarchy: {' > '.join(topic_path)}")
    parts.extend((f"Learning task: {task}", f"Student request: {student_input}"))
    return "\n".join(parts)


def _excerpt(content: str) -> str:
    return re.sub(r"\s+", " ", content).strip()[:500]


def _bounded_text(value: object, limit: int, fallback: str = "") -> str:
    return str(value).strip()[:limit] or fallback


def _vector_literal(values: list[float]) -> str:
    return "[" + ",".join(format(value, ".9g") for value in values) + "]"

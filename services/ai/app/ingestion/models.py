from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class IngestionClaim:
    job_id: UUID
    material_id: UUID
    pipeline_version: str
    attempt: int
    max_attempts: int
    storage_key: str
    media_type: str
    title: str
    original_filename: str


@dataclass(frozen=True)
class ParsedSection:
    content: str
    page_number: int | None = None
    section: str | None = None


@dataclass(frozen=True)
class MaterialChunk:
    position: int
    content: str
    content_hash: str
    page_number: int | None
    section: str | None
    source_metadata: dict[str, object]


@dataclass(frozen=True)
class EmbeddedChunk:
    chunk: MaterialChunk
    embedding: list[float]

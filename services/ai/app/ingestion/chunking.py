import hashlib

from .models import MaterialChunk, ParsedSection
from .parsing import normalize_text

CHUNK_MAX_CHARACTERS = 3_200
CHUNK_OVERLAP_CHARACTERS = 400


def chunk_sections(sections: list[ParsedSection]) -> list[MaterialChunk]:
    chunks: list[MaterialChunk] = []
    for source_index, section in enumerate(sections):
        normalized = normalize_text(section.content)
        for content in _split_text(normalized):
            chunks.append(
                MaterialChunk(
                    position=len(chunks),
                    content=content,
                    content_hash=hashlib.sha256(content.encode()).hexdigest(),
                    page_number=section.page_number,
                    section=section.section,
                    source_metadata={"sourceIndex": source_index},
                )
            )
    if not chunks:
        raise ValueError("The material contains no text after normalization.")
    return chunks


def _split_text(text: str) -> list[str]:
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_MAX_CHARACTERS, len(text))
        if end < len(text):
            boundary = text.rfind(" ", start, end)
            if boundary > start + CHUNK_MAX_CHARACTERS // 2:
                end = boundary
        content = text[start:end].strip()
        if content:
            chunks.append(content)
        if end >= len(text):
            break
        next_start = max(end - CHUNK_OVERLAP_CHARACTERS, start + 1)
        whitespace = text.find(" ", next_start, end)
        start = whitespace + 1 if whitespace >= 0 else next_start
    return chunks

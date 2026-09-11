from app.ingestion.chunking import (
    CHUNK_MAX_CHARACTERS,
    CHUNK_OVERLAP_CHARACTERS,
    chunk_sections,
)
from app.ingestion.models import ParsedSection
from app.ingestion.parsing import normalize_text, parse_document


def test_markdown_preserves_section_metadata():
    sections = parse_document(
        b"# Foundations\n\nFirst concept.\n\n## Details\n\nSecond concept.",
        "text/markdown",
    )
    chunks = chunk_sections(sections)

    assert [chunk.section for chunk in chunks] == ["Foundations", "Details"]
    assert chunks[0].content == "First concept."
    assert chunks[1].position == 1


def test_normalization_repairs_whitespace_and_line_hyphenation():
    assert normalize_text("  proba-\nbility  \r\n\r\n  next\tpart ") == (
        "probability\n\nnext part"
    )


def test_long_sections_are_bounded_and_overlap():
    content = " ".join(f"word-{index}" for index in range(2_000))
    chunks = chunk_sections([ParsedSection(content=content, page_number=3)])

    assert len(chunks) > 1
    assert all(len(chunk.content) <= CHUNK_MAX_CHARACTERS for chunk in chunks)
    assert all(chunk.page_number == 3 for chunk in chunks)
    assert CHUNK_OVERLAP_CHARACTERS > 0

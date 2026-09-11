import re
import unicodedata
from io import BytesIO

from pypdf import PdfReader

from .models import ParsedSection

SUPPORTED_MEDIA_TYPES = {"application/pdf", "text/plain", "text/markdown"}
_MARKDOWN_HEADING = re.compile(r"^#{1,6}\s+(.+?)\s*#*\s*$")


class DocumentParsingError(Exception):
    pass


def parse_document(data: bytes, media_type: str) -> list[ParsedSection]:
    if media_type not in SUPPORTED_MEDIA_TYPES:
        raise DocumentParsingError(f"Unsupported material type: {media_type}.")
    if media_type == "application/pdf":
        return _parse_pdf(data)

    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise DocumentParsingError("Text materials must use UTF-8 encoding.") from error
    if media_type == "text/markdown":
        return _parse_markdown(text)
    return [ParsedSection(content=text)]


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", value).replace("\x00", "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"(?<=\w)-\n(?=\w)", "", text)
    paragraphs = [
        re.sub(r"[ \t\f\v]+", " ", paragraph.replace("\n", " ")).strip()
        for paragraph in re.split(r"\n\s*\n", text)
    ]
    return "\n\n".join(paragraph for paragraph in paragraphs if paragraph)


def _parse_pdf(data: bytes) -> list[ParsedSection]:
    try:
        reader = PdfReader(BytesIO(data), strict=False)
        if reader.is_encrypted:
            raise DocumentParsingError("Encrypted PDFs are not supported.")
        sections = [
            ParsedSection(content=page.extract_text() or "", page_number=index)
            for index, page in enumerate(reader.pages, start=1)
        ]
    except DocumentParsingError:
        raise
    except Exception as error:
        raise DocumentParsingError("The PDF could not be parsed.") from error
    if not any(normalize_text(section.content) for section in sections):
        raise DocumentParsingError("The PDF contains no extractable text.")
    return sections


def _parse_markdown(text: str) -> list[ParsedSection]:
    sections: list[ParsedSection] = []
    current_heading: str | None = None
    current_lines: list[str] = []

    def flush() -> None:
        if current_lines:
            sections.append(
                ParsedSection(
                    content="\n".join(current_lines),
                    section=current_heading,
                )
            )

    for line in text.splitlines():
        heading = _MARKDOWN_HEADING.match(line)
        if heading:
            flush()
            current_heading = heading.group(1).strip()
            current_lines = []
        else:
            current_lines.append(line)
    flush()
    return sections or [ParsedSection(content=text)]

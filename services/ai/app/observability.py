import json
import logging
import re
from contextvars import ContextVar
from datetime import UTC, datetime
from time import perf_counter
from uuid import uuid4

from fastapi import Request, Response

REQUEST_ID_HEADER = "X-Request-ID"
_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_request_id: ContextVar[str] = ContextVar("request_id", default="unavailable")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", get_request_id()),
        }
        for field in (
            "event",
            "method",
            "path",
            "status_code",
            "duration_ms",
            "worker_id",
            "pipeline_version",
            "material_id",
            "job_id",
            "attempt",
            "chunk_count",
            "course_id",
            "topic_id",
            "task",
            "source_count",
            "result_count",
            "top_k",
            "top_similarity",
            "lowest_similarity",
            "topic_depth",
            "embedding_model",
            "embedding_input_tokens",
            "query_characters",
            "context_characters",
            "model",
            "input_tokens",
            "output_tokens",
            "total_tokens",
        ):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"), default=str)


def configure_logging(level: str) -> None:
    logger = logging.getLogger("cadebit")
    logger.setLevel(level.upper())
    logger.propagate = False
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)


def get_request_id() -> str:
    return _request_id.get()


async def request_logging_middleware(request: Request, call_next) -> Response:
    incoming_request_id = request.headers.get(REQUEST_ID_HEADER, "")
    request_id = (
        incoming_request_id
        if _REQUEST_ID_PATTERN.fullmatch(incoming_request_id)
        else str(uuid4())
    )
    token = _request_id.set(request_id)
    started_at = perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
    finally:
        duration_ms = round((perf_counter() - started_at) * 1_000, 2)
        logging.getLogger("cadebit.request").info(
            "request completed",
            extra={
                "event": "request.completed",
                "method": request.method,
                "path": request.url.path,
                "status_code": status_code,
                "duration_ms": duration_ms,
                "request_id": request_id,
            },
        )
        _request_id.reset(token)

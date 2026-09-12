import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

SERVICE_ROOT = Path(__file__).resolve().parent.parent
SUPPORTED_ENVIRONMENTS = {"development", "test", "production"}


def _load_local_environment() -> None:
    # Existing process values win, followed by local overrides and then defaults.
    load_dotenv(SERVICE_ROOT / ".env.local")
    load_dotenv(SERVICE_ROOT / ".env")


def _read_port(name: str, default: int) -> int:
    raw_value = os.getenv(name, str(default))

    try:
        value = int(raw_value)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer.") from error

    if not 1 <= value <= 65535:
        raise ValueError(f"{name} must be between 1 and 65535.")

    return value


def _read_int(name: str, default: int, minimum: int, maximum: int) -> int:
    raw_value = os.getenv(name, str(default))
    try:
        value = int(raw_value)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer.") from error
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}.")
    return value


def _read_float(name: str, default: float, minimum: float, maximum: float) -> float:
    raw_value = os.getenv(name, str(default))
    try:
        value = float(raw_value)
    except ValueError as error:
        raise ValueError(f"{name} must be a number.") from error
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}.")
    return value


def _optional_secret(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None


@dataclass(frozen=True)
class Settings:
    environment: str
    host: str
    port: int
    log_level: str
    database_url: str | None
    service_token: str | None
    openai_api_key: str | None
    openai_model: str
    openai_timeout_seconds: float
    openai_max_retries: int
    openai_max_output_tokens: int
    embedding_model: str
    rag_top_k: int
    rag_min_similarity: float
    rag_max_context_characters: int
    material_pipeline_version: str
    worker_poll_seconds: float
    worker_lease_seconds: int
    worker_retry_base_seconds: int
    s3_endpoint: str
    s3_region: str
    s3_bucket: str
    s3_access_key: str
    s3_secret_key: str
    s3_force_path_style: bool


def _read_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name, str(default)).strip().lower()
    if raw_value == "true":
        return True
    if raw_value == "false":
        return False
    raise ValueError(f"{name} must be true or false.")


@lru_cache
def get_settings() -> Settings:
    _load_local_environment()

    environment = os.getenv("CADEBIT_ENVIRONMENT", "development").strip().lower()
    if environment not in SUPPORTED_ENVIRONMENTS:
        supported = ", ".join(sorted(SUPPORTED_ENVIRONMENTS))
        raise ValueError(f"CADEBIT_ENVIRONMENT must be one of: {supported}.")

    return Settings(
        environment=environment,
        host=os.getenv("AI_SERVICE_HOST", "127.0.0.1").strip(),
        port=_read_port("AI_SERVICE_PORT", 8000),
        log_level=os.getenv("AI_SERVICE_LOG_LEVEL", "info").strip().lower(),
        database_url=os.getenv("DATABASE_URL"),
        service_token=_optional_secret("AI_SERVICE_TOKEN"),
        openai_api_key=_optional_secret("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-5.6-luna").strip()
        or "gpt-5.6-luna",
        openai_timeout_seconds=_read_float("OPENAI_TIMEOUT_SECONDS", 30.0, 1.0, 300.0),
        openai_max_retries=_read_int("OPENAI_MAX_RETRIES", 2, 0, 5),
        openai_max_output_tokens=_read_int(
            "OPENAI_MAX_OUTPUT_TOKENS", 1_200, 64, 10_000
        ),
        embedding_model=os.getenv(
            "OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"
        ).strip()
        or "text-embedding-3-small",
        rag_top_k=_read_int("RAG_TOP_K", 6, 1, 20),
        rag_min_similarity=_read_float("RAG_MIN_SIMILARITY", 0.15, -1.0, 1.0),
        rag_max_context_characters=_read_int(
            "RAG_MAX_CONTEXT_CHARACTERS", 16_000, 1_000, 50_000
        ),
        material_pipeline_version=os.getenv("MATERIAL_PIPELINE_VERSION", "v1").strip()
        or "v1",
        worker_poll_seconds=_read_float(
            "INGESTION_WORKER_POLL_SECONDS", 2.0, 0.1, 60.0
        ),
        worker_lease_seconds=_read_int(
            "INGESTION_WORKER_LEASE_SECONDS", 600, 30, 3_600
        ),
        worker_retry_base_seconds=_read_int(
            "INGESTION_RETRY_BASE_SECONDS", 5, 1, 3_600
        ),
        s3_endpoint=os.getenv("S3_ENDPOINT", "http://127.0.0.1:9000").strip(),
        s3_region=os.getenv("S3_REGION", "us-east-1").strip(),
        s3_bucket=os.getenv("S3_BUCKET", "cadebit-materials").strip(),
        s3_access_key=os.getenv("S3_ACCESS_KEY", "cadebit").strip(),
        s3_secret_key=os.getenv(
            "S3_SECRET_KEY", "cadebit-local-storage-secret"
        ).strip(),
        s3_force_path_style=_read_bool("S3_FORCE_PATH_STYLE", True),
    )

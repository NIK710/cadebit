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


@dataclass(frozen=True)
class Settings:
    environment: str
    host: str
    port: int
    log_level: str


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
    )

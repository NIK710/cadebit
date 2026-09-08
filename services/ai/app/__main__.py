import uvicorn

from .config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        f"{__package__}.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level,
        reload=settings.environment == "development",
    )


if __name__ == "__main__":
    main()

from fastapi import FastAPI

from .config import get_settings

settings = get_settings()

app = FastAPI(
    title="CadeBit AI Service",
    version="0.1.0",
    debug=settings.environment == "development",
)


@app.get("/health")
def health():
    return {"status": "ok"}

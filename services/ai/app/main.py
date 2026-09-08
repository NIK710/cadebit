from fastapi import FastAPI

app = FastAPI(
    title="CadeBit AI Service",
    version="0.1.0",
)


@app.get("/health")
def health():
    return {"status": "ok"}
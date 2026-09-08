FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV CADEBIT_ENVIRONMENT=production
ENV AI_SERVICE_HOST=0.0.0.0
ENV AI_SERVICE_PORT=8000

WORKDIR /app

RUN addgroup --system cadebit \
    && adduser --system --ingroup cadebit cadebit

COPY requirements.txt ./
RUN python -m pip install --no-cache-dir --requirement requirements.txt

COPY --chown=cadebit:cadebit app ./app

USER cadebit
EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"]

CMD ["python", "-m", "app"]

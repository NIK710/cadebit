# Course material ingestion

Course material ingestion runs as a durable PostgreSQL-backed pipeline. The
Next.js app accepts authorized uploads and writes the object plus database
metadata; a separate Python worker claims and processes jobs. FastAPI does not
run background tasks, and Redis is not required.

## Data flow

```text
course admin
  -> Next.js server action (authorization and validation)
  -> private S3-compatible object storage
  -> materials + course_materials + material_ingestion_jobs transaction
  -> separate AI worker
  -> parse and normalize
  -> deterministic chunks and OpenAI embeddings
  -> transactional replacement of material_chunks
```

The web app rechecks course-admin authorization inside the same database
transaction that creates the material records and ingestion job. Material
list queries begin at the authenticated user's course membership, so records
cannot be listed through a course the user cannot access.

## Storage and supported files

Local Docker development uses MinIO, an S3-compatible object store. Uploaded
objects are private and use generated keys; user-provided filenames are stored
as metadata, not used as object keys. Production can use any compatible private
S3 service through the same configuration.

The initial pipeline accepts PDF, UTF-8 plain text, and Markdown files up to
20 MB. PDF page numbers and Markdown section headings are retained on the
resulting chunks when available. Extracted text is normalized before
deterministic, overlapping chunking.

## Job lifecycle and recovery

Jobs move through `pending`, `processing`, `retry`, `complete`, and `failed`.
Workers claim jobs with `FOR UPDATE SKIP LOCKED`, record a worker ID and attempt
number, and periodically extend the lease. A job whose lease expires can be
claimed by another worker. All heartbeat, completion, and failure updates are
fenced by worker ID and attempt, so a stale worker cannot overwrite the result
of its replacement.

Failures use exponential retry delays until `max_attempts` is reached. Error
messages are bounded before storage. A retry never exposes a partial set of
chunks: completion locks the claimed job, deletes the previous chunks, inserts
the complete replacement set, and marks both the material and job complete in
one transaction.

## Idempotency and pipeline versions

Each material stores a SHA-256 content hash. There is at most one ingestion job
for a `(material_id, pipeline_version)` pair and at most one chunk for a
`(material_id, pipeline_version, position)` tuple. The worker only claims jobs
for its configured `MATERIAL_PIPELINE_VERSION`.

Changing parsing, chunking, or embedding behavior should use a new pipeline
version. Enqueue a job for the new version; successful completion atomically
replaces the old chunks and records the new version on the material. Drizzle in
`apps/web` remains the sole owner of tables, indexes, and migrations. The Python
worker consumes that schema and never creates or migrates it.

## Configuration

The web upload path and worker share:

- `MATERIAL_PIPELINE_VERSION`
- `S3_ENDPOINT`, `S3_REGION`, and `S3_BUCKET`
- `S3_ACCESS_KEY`, `S3_SECRET_KEY`, and `S3_FORCE_PATH_STYLE`

The worker additionally uses `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`,
`INGESTION_WORKER_POLL_SECONDS`, `INGESTION_WORKER_LEASE_SECONDS`, and
`INGESTION_RETRY_BASE_SECONDS`. See the service-specific `.env.example` files
for defaults.

## Running locally

Start the complete development stack, including PostgreSQL, MinIO, migrations,
the API, worker, and web app:

```bash
docker compose -f compose.yaml -f compose.dev.yml up --build
```

The MinIO S3 endpoint is <http://localhost:9000> and its console is
<http://localhost:9001>. The development credentials are defined by the root
environment template. They are local defaults only and must not be reused in a
deployed environment.

Python source edits are visible in the worker's bind mount, but the worker is a
long-running process without an auto-reloader. Restart it after worker changes:

```bash
docker compose -f compose.yaml -f compose.dev.yml restart ai-worker
```

Dependency files, Dockerfiles, Compose changes, and migration changes require a
rebuild or explicit migration run as described in the repository README.

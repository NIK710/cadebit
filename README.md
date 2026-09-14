# CadeBit

CadeBit is a web-first learning platform that turns course material into an
adaptive study system. The repository contains a Next.js web app, PostgreSQL
with pgvector, and a focused FastAPI service for AI and RAG workflows.

Read [PROJECT.md](PROJECT.md) for the product and architecture direction and
[TASKS.md](TASKS.md) for the implementation backlog.

## Repository layout

```text
apps/web/       Next.js, React, TypeScript, and Tailwind CSS
services/ai/    FastAPI AI service
apps/web/drizzle/ Versioned PostgreSQL migrations
```

## Prerequisites

- Node.js 22 and npm
- Python 3.12
- GNU Make for the root convenience commands
- Docker with Compose, optionally

## Local setup

Create local environment files from the committed templates:

```bash
cp apps/web/.env.example apps/web/.env.local
cp services/ai/.env.example services/ai/.env.local
```

Install the web dependencies:

```bash
cd apps/web
npm install
```

Create the AI service virtual environment and install its development
dependencies:

```bash
python3.12 -m venv services/ai/.venv
services/ai/.venv/bin/python -m pip install --requirement services/ai/requirements-dev.txt
```

Do not commit local environment files or put secrets in the example files.

Start PostgreSQL and apply the canonical Drizzle migrations:

```bash
docker compose up -d database
cd apps/web
npm run db:migrate
```

## Run locally

Start the AI service in one terminal:

```bash
cd services/ai
.venv/bin/python -m app
```

Start the web app in another terminal:

```bash
cd apps/web
npm run dev
```

The web app runs at <http://localhost:3000>. The AI health endpoint is available
at <http://localhost:8000/health>.

The internal AI generation contract and its required environment variables are
documented in [docs/AI_SERVICE.md](docs/AI_SERVICE.md). Course uploads and the
durable ingestion worker are documented in [docs/INGESTION.md](docs/INGESTION.md).
Permission-aware semantic retrieval and its diagnostics are documented in
[docs/RAG.md](docs/RAG.md).
The repository-owned retrieval and model-quality regression harness is
documented in [docs/EVALUATION.md](docs/EVALUATION.md).
Use the same
`AI_SERVICE_TOKEN` in both services; `OPENAI_API_KEY` belongs only in the AI
service environment.

Create an account at <http://localhost:3000/signup>, then use those credentials
on the login page. Better Auth stores users, password credentials, and sessions
in PostgreSQL.

Course management is also PostgreSQL-backed. Students can create private
independent courses or shared courses. A shared-course admin receives a unique
six-character join code to give to other students. Topic structure is editable
only by admins; target dates, completion, confidence, and study activity remain
specific to each member.

Once a material is processed, every course member can use Ask CadeBit for a
grounded answer, explanation, or summary. An optional topic selection enriches
semantic ranking with that topic's hierarchy, and returned page/section source
references appear beneath the response.

The course page also links to an adaptive study flow. It recommends a topic
deterministically from schedule urgency, target-date pressure, completion,
recency, and system mastery; generates a source-grounded practice question;
grades against its stored rubric; and preserves raw evidence separately from
the student's self-confidence rating.

## Quality checks

Run the repository checks from the project root:

```bash
make lint
make format-check
make test
```

Check that the migration history matches the canonical Drizzle schema:

```bash
cd apps/web
npm run db:check
```

With the local database running, execute the database-backed authentication and
course authorization tests with `npm run test:integration` from `apps/web`.

Apply automatic formatting and safe lint fixes with:

```bash
make format
```

Build the web app directly with:

```bash
cd apps/web
npm run build
```

## Docker

For containerized development with Next.js hot reload and Uvicorn reload, use
the development override:

```bash
docker compose -f compose.yaml -f compose.dev.yml up --build
```

Changes under `apps/web/app`, `apps/web/lib`, and other mounted web source paths
reload through the Next.js development server. Python API changes under
`services/ai/app` restart Uvicorn automatically. The ingestion worker shares
the source bind mount but must be restarted after its source changes:

```bash
docker compose -f compose.yaml -f compose.dev.yml restart ai-worker
```

Drizzle migration files are also mounted into the one-shot migration service;
after adding a migration, rerun it with:

```bash
docker compose -f compose.yaml -f compose.dev.yml run --rm migrate
```

Dependency manifests and Dockerfile changes still require rebuilding. When web
dependencies change, renew the anonymous `node_modules` volume so it is filled
from the rebuilt development image:

```bash
docker compose -f compose.yaml -f compose.dev.yml up --build --renew-anon-volumes
```

When Python requirements change, rebuild both Python processes:

```bash
docker compose -f compose.yaml -f compose.dev.yml up --build ai ai-worker
```

Stop the development stack with:

```bash
docker compose -f compose.yaml -f compose.dev.yml down
```

The source bind mounts do not replace the web container's dependencies:
anonymous volumes keep `/app/node_modules` and `/app/.next` inside Docker.

### Production-shaped Compose

Build and run both current services:

```bash
docker compose up --build
```

Stop them with:

```bash
docker compose down
```

Compose starts PostgreSQL with pgvector, creates the private MinIO bucket,
applies Drizzle migrations once, and then starts the web, AI, and separate
ingestion-worker services. Drizzle is the only migration owner; the FastAPI
service and worker may consume the database but do not maintain migrations.

The Compose setup is intended as a production-shaped local smoke test. Normal
feature development is faster with the service-specific development commands
above.

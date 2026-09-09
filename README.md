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

Create an account at <http://localhost:3000/signup>, then use those credentials
on the login page. Better Auth stores users, password credentials, and sessions
in PostgreSQL.

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

With the local database running, execute the database-backed authentication
test with `npm run test:integration` from `apps/web`.

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

Build and run both current services:

```bash
docker compose up --build
```

Stop them with:

```bash
docker compose down
```

Compose starts PostgreSQL with pgvector, applies Drizzle migrations once, and
then starts the web and AI services. Drizzle is the only migration owner; the
FastAPI service may consume the database but does not maintain migrations.

The Compose setup is intended as a production-shaped local smoke test. Normal
feature development is faster with the service-specific development commands
above.

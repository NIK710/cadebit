# CadeBit

CadeBit is a web-first learning platform that turns course material into an
adaptive study system. The repository currently contains a Next.js web app and
a focused FastAPI service for future AI and RAG workflows.

Read [PROJECT.md](PROJECT.md) for the product and architecture direction and
[TASKS.md](TASKS.md) for the implementation backlog.

## Repository layout

```text
apps/web/       Next.js, React, TypeScript, and Tailwind CSS
services/ai/    FastAPI AI service
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

For the initial local authentication flow, sign in with the development account
from `apps/web/.env.local`. The example credentials are:

```text
Email: student@cadebit.local
Password: cadebit-local
```

This environment-backed account is only for local Phase 1 development. Durable
users and account records will move to PostgreSQL in Phase 2; do not reuse the
example session secret or password in a deployed environment.

## Quality checks

Run the repository checks from the project root:

```bash
make lint
make format-check
make test
```

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

The Compose setup is intended as a production-shaped local smoke test. Normal
feature development is faster with the service-specific development commands
above.

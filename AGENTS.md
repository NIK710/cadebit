# AGENTS.md

This file defines how AI coding agents should work inside the CadeBit repository.

## Project Context

CadeBit is a web-first learning platform for real students. The current focus is the core web app, backend, database, AI/RAG system, and production-quality deployment.

Do not prioritize or build the browser extension, mobile app, push notifications, or email delivery yet unless explicitly requested.

Read `PROJECT.md` before making architectural or product decisions.

## Core Engineering Principles

- Prefer simple, production-appropriate implementations over impressive-looking complexity.
- Do not introduce technology only for resume keywords.
- Keep ordinary product logic deterministic.
- Use RAG when AI needs grounded course context.
- Use agentic/multi-step AI only where adaptive decision-making provides real product value.
- Prefer a modular application plus one focused FastAPI AI service over unnecessary microservices.
- Start with PostgreSQL + pgvector before introducing a dedicated vector database.
- Do not add Kubernetes unless deployment complexity genuinely requires it.
- Enforce authorization server-side.
- Preserve raw learning evidence instead of prematurely hard-coding mastery formulas.

## Current Stack Direction

Frontend:
- Next.js
- React
- TypeScript
- Tailwind CSS

Backend / data:
- PostgreSQL
- pgvector
- REST-style APIs
- object storage for uploaded documents

AI service:
- Python
- FastAPI
- OpenAI API
- RAG pipeline
- retrieval/evaluation tooling

Infrastructure:
- GitHub
- Docker where useful
- managed hosting/database/storage
- CI/CD
- logging/error monitoring

## UI Rules

The initial CadeBit UI must stay intentionally minimal.

Use:
- white backgrounds
- black borders
- simple rectangular cards
- simple buttons
- simple icons
- subtle gray shading for hover/press/selected states
- clear spacing and typography

Avoid:
- gradients
- bright accent colors
- glassmorphism
- decorative shadows
- large rounded "startup SaaS" cards
- excessive animation
- ornamental illustrations
- visual complexity that does not improve usability

The goal is to make functionality, information architecture, and interaction quality good before styling the product heavily.

## Code Quality

When writing code:

- Match existing repository conventions.
- Keep components/functions focused.
- Avoid premature abstractions.
- Prefer explicit names over clever names.
- Add types rather than falling back to `any`.
- Validate external/user input.
- Handle failure states.
- Avoid exposing secrets or API keys client-side.
- Add tests for meaningful business logic and permissions.
- Keep AI prompts/model configuration isolated from unrelated application code.

## Database Rules

- Use stable IDs and explicit foreign keys.
- Model shared course data separately from per-user learning state.
- Keep `completed` distinct from `mastered/confident` where useful.
- Store AI/system assessment separately from user self-assessment.
- Scope user-specific schedules/progress to the user even inside shared courses.
- Preserve event/assessment records needed for future learning-model improvements.
- Uploaded files belong in object storage; relational metadata belongs in PostgreSQL.

## AI / RAG Rules

Any course-grounded AI action should follow authorization-aware retrieval:

```text
user
  -> authorized course
  -> authorized material
  -> optional topic/subtopic scope
  -> retrieve
  -> generate
```

Never retrieve across unrelated/private course material.

For RAG work:
- preserve source metadata
- keep page/section/material references where possible
- evaluate retrieval quality
- avoid claiming grounding when evidence was not retrieved
- structure the system so prompts/models can change later

## Working Process

Before implementing a substantial task:

1. Read `PROJECT.md`.
2. Read `TASKS.md`.
3. Inspect the existing implementation before assuming structure.
4. Choose the smallest change that satisfies the task.
5. Update tests where appropriate.
6. Update `TASKS.md` when a tracked task meaningfully changes state.

Do not rewrite major architecture without an explicit reason.

## Scope Discipline

If a requested change conflicts with `PROJECT.md`, flag the conflict rather than silently changing the product direction.

If there are multiple viable implementations, prefer the one that:
1. keeps the product simpler,
2. is easier to maintain,
3. serves real users reliably,
4. leaves reasonable room to evolve.

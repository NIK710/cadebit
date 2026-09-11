# AI service contract

The FastAPI service exposes one internal generation endpoint:

```text
POST /v1/generate
Authorization: Bearer <AI_SERVICE_TOKEN>
Content-Type: application/json
```

This is a server-to-server API. Browser code must call a Next.js server action
or route handler, which obtains the authenticated user ID and uses the
server-only client in `apps/web/lib/ai-service.ts`. The shared service token must
never be exposed to the browser.

## Request

```json
{
  "user_id": "authenticated-user-id",
  "course_id": "4de11dff-5831-4113-8c63-51e4ad8bb7a2",
  "topic_id": "feeb5a78-986e-40c7-9456-ce6b1bdd318f",
  "task": "explain",
  "input": "Explain lexical scope."
}
```

`topic_id` is optional. `task` is one of `answer`, `explain`, `summarize`, or
`quiz`. The FastAPI service verifies the bearer token and then independently
checks `course_memberships` for the supplied user and course before invoking any
generation code.

## Response

```json
{
  "request_id": "web-request-id",
  "response_id": "resp_123",
  "task": "explain",
  "content": "Generated course-grounded content.",
  "sources": [
    {
      "material_id": "86a9168a-6a1d-4d63-b77f-f1582fe67346",
      "material_title": "Lecture 3",
      "chunk_id": "1c4cc166-2ca4-430e-a51c-84380980df57",
      "page_number": 4,
      "section": "Closures",
      "excerpt": "A closure retains its lexical environment."
    }
  ],
  "model": "gpt-5.6-luna",
  "usage": {
    "input_tokens": 120,
    "output_tokens": 48,
    "total_tokens": 168
  }
}
```

Source references are structured data so the web app can render citations
without parsing model-written text. Material ingestion is implemented by the
separate worker documented in [INGESTION.md](INGESTION.md). Retrieval remains a
Phase 6 concern, so the current generation path still returns `"sources": []`
and the model is instructed not to claim course grounding or substitute general
knowledge.

## Failures

All expected failures use the same envelope:

```json
{
  "error": {
    "code": "course_access_denied",
    "message": "The user cannot access this course.",
    "request_id": "request-id"
  }
}
```

The primary statuses are:

- `401` invalid or missing service token
- `403` user is not a course member
- `422` invalid request contract
- `429` OpenAI rate limit
- `502` invalid or rejected upstream response
- `503` missing configuration, database authorization failure, or connection
  failure
- `504` OpenAI request timeout

Every response includes `X-Request-ID`. Request logs are JSON and include that
ID, method, path, status, and duration. Logs do not include prompts, source
contents, credentials, or generated content.

## Boundaries

- `routes/generate.py` owns only HTTP transport concerns.
- `authorization.py` owns service authentication and PostgreSQL membership
  authorization.
- `orchestration.py` owns task instructions and grounding orchestration.
- `openai_client.py` is the isolated OpenAI Responses API adapter.
- `apps/web/lib/ai-service.ts` is the server-only Next.js adapter.

Drizzle remains the sole schema and migration owner. The AI service reads
PostgreSQL for authorization but does not maintain a migration system.
Document parsing and embedding run in the separate durable ingestion worker,
not in a FastAPI in-process background task.

## Configuration

Set the same strong random `AI_SERVICE_TOKEN` for the web and AI services. The
AI service also requires `OPENAI_API_KEY` to generate. `OPENAI_MODEL` is
configurable and defaults to `gpt-5.6-luna`; timeouts, retries, and output limits
are configurable through the variables documented in the service `.env.example`.

# Retrieval-augmented generation

Phase 6 grounds CadeBit's existing `/v1/generate` contract in processed course
material. The browser still calls a Next.js server action, and only the web
server calls the internal FastAPI endpoint.

## Retrieval boundary

The retrieval SQL starts with the authenticated user and requested course:

```text
course_memberships
  -> course_materials
  -> ready materials
  -> material_chunks for the material's active pipeline version
```

It also requires each chunk's embedding model to match the configured query
embedding model. Course authorization is checked before orchestration and is
enforced again by the retrieval join. A membership change between those checks
can therefore reduce the result to no sources but cannot expose another
course's chunks.

## Semantic topic scope

`topic_id` remains optional. When supplied, the service verifies the topic
belongs to the authorized course and recursively loads its ancestor path. The
course name, topic hierarchy, task, and student's request form the semantic
query that is embedded for cosine-similarity search.

Topic scope influences ranking rather than acting as a hard chunk filter.
CadeBit does not currently create chunk-to-topic mappings. Retrieval diagnostics
are intended to show whether semantic scoping is sufficient before that extra
schema and classification pipeline are introduced.

## Grounding and sources

The top matching chunks above `RAG_MIN_SIMILARITY` are supplied to the model up
to `RAG_MAX_CONTEXT_CHARACTERS`. The prompt treats source text as untrusted data
and asks the model to cite the numbered sources inline. The unchanged response
contract returns structured material, chunk, page, section, and excerpt fields
so the course UI can render the references independently of model-written text.

If no relevant processed source is found, generation is explicitly instructed
not to answer from general knowledge or claim grounding.

## Diagnostics

Successful retrieval emits a structured `retrieval.completed` log containing:

- retrieval latency
- query and context character counts
- query-embedding input tokens and embedding model
- configured top-k and returned source count
- highest and lowest included similarity
- topic ID and hierarchy depth when scoped

Generation emits a separate `generation.completed` event with the task, model,
source count, and available input/output/total token usage. Logs never contain
the student's request, source text, or generated response.

The main tuning variables are:

```text
RAG_TOP_K=6
RAG_MIN_SIMILARITY=0.15
RAG_MAX_CONTEXT_CHARACTERS=16000
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

Changing the embedding model also requires re-ingesting material with that
model; retrieval intentionally excludes vectors produced by a different model.

## Evaluation coverage

The PostgreSQL integration fixture uses deterministic vectors to verify:

- chunks attached to another course cannot be returned, even when they are a
  perfect semantic match;
- a topic from another course is rejected;
- an unauthorized user cannot invoke retrieval for the course;
- adding a parent/subtopic hierarchy changes the deterministic ranking.

The AI CI job applies the canonical Drizzle migrations and runs these tests
against PostgreSQL with pgvector. Drizzle remains the only migration owner.

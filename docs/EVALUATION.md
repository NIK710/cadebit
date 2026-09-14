# AI evaluation

CadeBit keeps its evaluation harness, labeled datasets, thresholds, and
deterministic baseline in `services/ai/evaluation`. It does not read production
courses or add evaluation tables to the production schema.

The design follows OpenAI's recommendation to use task-specific datasets,
automated metrics, narrow reference-guided rubrics, and human calibration. The
repository owns the harness because OpenAI's hosted Evals platform is scheduled
for shutdown on November 30, 2026. See the current
[evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

## Suites

### Deterministic retrieval

`retrieval_corpus_v1.jsonl` defines a small dedicated course corpus with fixed
fixture embeddings. `retrieval_v1.jsonl` provides human-labeled queries,
relevant chunk IDs, topic hierarchy, and K values.

The runner creates isolated users, courses, materials, topics, and chunks in
the database named by `EVAL_DATABASE_URL`, invokes the real
`PostgresGroundingProvider`, records its diagnostics, and removes all fixture
records afterward. Fixed vectors make Recall@K, Precision@K, and MRR
deterministic without an OpenAI request. A deliberately colliding private
chunk verifies that retrieval does not cross course boundaries.

Never set `EVAL_DATABASE_URL` to a production database. Apply the canonical
Drizzle migrations to a dedicated local or CI database first.

For example, with the development Compose database running, create and migrate
an evaluation-only database from the repository root:

```bash
docker compose -f compose.yaml -f compose.dev.yml exec database \
  createdb -U cadebit cadebit_eval
DATABASE_URL=postgresql://cadebit:cadebit@127.0.0.1:5432/cadebit_eval \
  npm --prefix apps/web run db:migrate
```

Run the checked-in regression gate from `services/ai`:

```bash
EVAL_DATABASE_URL=postgresql://cadebit:cadebit@127.0.0.1:5432/cadebit_eval \
  .venv/bin/python -m evaluation \
  --suite retrieval \
  --fail-on-regression
```

This deterministic command also runs in CI, and its complete JSON report is
uploaded as a workflow artifact.

### Live model quality

The live suite is explicit and is never run automatically in CI. It uses:

- `generation_v1.jsonl` for grounded answers and generated-question quality;
- a structured reference-guided model judge for grounding and quality;
- `grading_v1.jsonl` for human-labeled score ranges;
- repeated grading calls to measure score spread and agreement with those
  ranges.

Run it only when you intend to incur model usage:

```bash
OPENAI_API_KEY=... \
OPENAI_MODEL=gpt-5.6-luna \
EVAL_JUDGE_MODEL=gpt-5.6-luna \
  .venv/bin/python -m evaluation \
  --suite live \
  --output ../../artifacts/evaluations \
  --fail-on-regression
```

`--suite all` combines retrieval and live results and therefore requires both
`EVAL_DATABASE_URL` and `OPENAI_API_KEY`.

## Reports and regression gates

Every report contains aggregate metrics and the complete output for each case.
Provenance includes:

- every dataset and configuration version;
- Git commit and dirty-worktree status;
- Python version;
- embedding, generation, and judge models;
- retrieval, generation, question, grading, and judge prompt versions;
- thresholds and baseline path;
- per-call and aggregate token usage.

Thresholds live in `evaluation/config.json`. The default deterministic baseline
is `evaluation/baselines/retrieval_v1.json`. `--baseline PATH` can compare any
suite to a reviewed baseline. `--fail-on-regression` exits nonzero when a
threshold fails or a metric worsens beyond the configured tolerance. Lower is
better only for `grading_max_score_spread`; higher is better for all other
current metrics.

Reports default to `artifacts/evaluations`, which is ignored by Git. To update a
baseline, first review the full per-case report and confirm that any changed
labels or outputs are intentional. Do not replace a baseline merely to make a
failing run green.

## Growing the datasets

JSONL records reject unknown fields, duplicate IDs, mixed versions, invalid
score ranges, and invalid K values. Increment the dataset version whenever
labels or cases change. Add representative production failure patterns only
after removing personal data and rewriting them as synthetic, human-reviewed
fixtures. Human labels remain canonical; model-judge results are supporting
signals and should be periodically checked for agreement with human review.

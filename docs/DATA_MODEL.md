# CadeBit Data Model

Drizzle is the canonical owner of CadeBit's PostgreSQL schema and migrations.
All table definitions live in `apps/web/lib/db/schema`, and all versioned SQL
migrations live in `apps/web/drizzle`.

The FastAPI AI service may connect to PostgreSQL and pgvector for ingestion,
retrieval, and evaluation. It must not create a parallel schema definition or
migration history.

## Main boundaries

- Better Auth owns users, sessions, accounts, and verification records through
  tables represented in the canonical Drizzle schema.
- Courses distinguish shared courses from independent courses.
- Every course owner must also receive an admin membership in the same creation
  transaction. An independent course starts with only that membership.
- Membership roles control changes to shared course structure. Learning state
  remains scoped to the individual user.
- Topics use a self-referencing hierarchy. The composite parent constraint
  prevents a topic from using a parent in another course.
- Materials store relational metadata and an object-storage key. File bytes do
  not belong in PostgreSQL.
- Course-material associations allow reusable material to be attached to more
  than one course.

## Learning evidence

Completion, user self-assessment, and system evidence are intentionally
separate:

- `user_topic_progress` records completion and recent study timestamps.
- `user_self_assessments` records the student's current 1–5 rating.
- `assessment_evidence` preserves raw quiz and model evidence, including score,
  difficulty, hints, response time, model, and prompt version.

No fixed mastery formula is stored in the schema. A derived system assessment
can evolve without losing the evidence from which it was calculated.

## Time and streaks

`study_sessions` capture bounded study periods. `activity_events` preserve the
individual events and optional durations used for time-spent reporting.

Streaks are derived from qualifying activity events grouped by the user's local
calendar day. Overall streaks use all qualifying events; course streaks add a
course filter. Mutable streak counters are deliberately omitted so historical
activity can be re-evaluated when the qualification rule or timezone handling
changes.

## Personalized schedules

`user_course_schedules` has one target per user and course. `schedule_items`
belong to that personalized schedule, so changing one student's target date or
plan cannot alter another member's schedule.

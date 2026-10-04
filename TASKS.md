# TASKS.md

This is the working implementation backlog for CadeBit.

Keep this file focused on actionable engineering work. `PROJECT.md` explains the product and architecture; `AGENTS.md` explains how coding agents should work.

## Status Legend

- [ ] Not started
- [~] In progress
- [x] Done
- [!] Blocked / needs decision

## Phase 0 — Repository Foundation

- [x] Establish monorepo structure
- [x] Create Next.js + TypeScript web app
- [x] Create FastAPI AI service
- [x] Add local environment configuration
- [x] Add `.env.example`
- [x] Add linting / formatting
- [x] Add basic test setup
- [x] Add Docker support where useful
- [x] Add CI workflow
- [x] Document local development commands

## Phase 1 — Core Web App

- [x] Add authentication
- [x] Create authenticated app shell
- [x] Build minimal dashboard
- [x] Build course list
- [x] Build course creation flow
- [x] Build course detail page
- [x] Build topic/subtopic display
- [x] Build account/settings page

### Initial UI Constraint

All Phase 1 UI should remain extremely simple:

- white background
- black borders
- simple cards
- simple buttons/icons
- slight gray hover/pressed/selected shading
- minimal/no decorative animation
- no visual polish work beyond clear spacing, typography, and usability

Do not spend time on elaborate branding or visual design yet.

## Phase 2 — Database / Domain Model

- [x] Set up PostgreSQL
- [x] Define users
- [x] Define courses
- [x] Define course memberships
- [x] Define admin/member roles
- [x] Define topics
- [x] Define subtopic hierarchy
- [x] Define materials
- [x] Define course-material associations
- [x] Define per-user topic progress
- [x] Define AI assessment evidence
- [x] Define user self-assessment
- [x] Define study sessions
- [x] Define activity/time-spent tracking
- [x] Define streak derivation strategy
- [x] Define user-specific schedules / target dates
- [x] Define independent/private course behavior
- [x] Add migrations
- [x] Add authorization tests

## Phase 3 — Course Management

- [x] Create/join course
- [x] Admin can edit topic structure
- [x] Members can view shared structure
- [x] Members cannot modify canonical structure
- [x] User can create a private independent course
- [x] User can change their own target completion date
- [x] User schedule changes do not alter other members
- [x] Track topic/subtopic completion
- [x] Track user confidence/self-assessment
- [x] Track study activity

## Phase 4 — FastAPI AI Service

- [x] Add health endpoint
- [x] Define service configuration
- [x] Add OpenAI client abstraction
- [x] Define web-app-to-AI-service API contract
- [x] Add structured logging
- [x] Add service tests
- [x] Add failure/timeout handling

## Phase 5 — Course Material Ingestion

- [x] Add course material upload flow
- [x] Add object storage
- [x] Store material metadata in PostgreSQL
- [x] Parse supported documents
- [x] Normalize extracted text
- [x] Chunk material
- [x] Preserve source/page/section metadata
- [x] Generate embeddings
- [x] Add pgvector
- [x] Store embeddings
- [x] Make ingestion idempotent
- [x] Handle failed ingestion

## Phase 6 — RAG

- [x] Implement permission-aware retrieval
- [x] Filter retrieval by authorized course/material
- [x] Add optional topic/subtopic filtering
- [x] Return source metadata with retrieval results
- [x] Build grounded Q&A
- [x] Build grounded explanation generation
- [x] Build grounded summaries
- [x] Surface source references in UI
- [x] Add retrieval latency/token logging

## Phase 7 — Adaptive Study

- [x] Generate practice questions
- [x] Support structured answer grading
- [x] Store assessment evidence
- [x] Derive initial mastery/confidence signal
- [x] Keep AI assessment separate from self-assessment
- [x] Recommend next topic
- [x] Incorporate schedule/deadline pressure
- [x] Create basic adaptive study session flow
- [x] Update progress after study activity

## Phase 8 — Evaluation

- [x] Build labeled retrieval evaluation set
- [x] Measure Recall@K
- [x] Measure Precision@K
- [x] Measure ranking/MRR where useful
- [x] Add grounding checks
- [x] Evaluate generated-question quality
- [x] Evaluate grading consistency
- [x] Add regression evaluation command
- [x] Record model/prompt configuration in eval outputs

## Phase 9 — Product Experience Revision

Phase 9 intentionally revises the product experience produced by Phases 1–8.
Those earlier capabilities remain implemented; do not uncheck their historical tasks.
Keep the existing minimal visual language and avoid unrelated redesign work.

### Phase 9A — Course Detail UX

- [x] Keep the Target Date summary card and move target-date editing into a small modal opened by a pencil/edit icon
- [x] Place the displayed date and edit icon on the same row, with the date left-aligned and the icon right-aligned and vertically centered
- [x] Include the target completion date label, date picker, user-specific schedule explanation, Cancel, and Save actions in the modal
- [x] Preserve per-user target dates and ensure saving updates the date and closes the modal
- [x] Remove the permanent Materials section from the main course page
- [x] Add a clear `Course materials` action near the course header that opens a management modal or drawer
- [x] Show existing material title, filename where appropriate, size where available, and processing status in the management interface
- [x] Preserve uploaded/processing/ready/failed material states and allow admins to upload additional material there
- [x] Add authorized material removal, including failed uploads, using a neutral trash/delete icon and appropriate confirmation
- [x] Keep detailed ingestion/provider errors in server logs and show concise student-facing failures such as `Processing failed. Try again.`
- [x] Remove the permanent Ask CadeBit form, including task, topic-scope, request, and Generate controls, without removing grounded RAG capabilities

### Phase 9B — Course Outline UX

- [x] Replace the administrative topic cards/forms with a clearly indented visual hierarchy supporting exactly Topic, Subtopic, and Sub-subtopic semantic levels
- [x] Add a familiar six-dot/grip drag handle to each outline item
- [x] Support manual sibling ordering and persist the resulting positions correctly
- [x] Evaluate and implement sensible hierarchy movement only if it remains clear, reliable, and compatible with the existing model
- [x] Remove the permanent `Add to course structure` form and parent dropdown
- [x] Add an `+ Add topic` action in the Topics and Subtopics header
- [x] Let an admin add a child directly from an eligible item's actions; do not offer Add child on level-3 items
- [x] Add a three-dot per-item action menu with permission/depth-appropriate Rename, Edit context, Add child/subtopic, and Delete actions
- [x] Preserve shared-course authorization: admins edit canonical structure, members view it, and independent-course owners/admins edit it
- [x] Add appropriate deletion confirmation, especially when descendants will also be deleted
- [x] Use the existing topic description/context field if suitable; do not create redundant context storage
- [x] Add a small context editor modal and keep optional context out of the permanently visible outline
- [x] Add a bulk outline editor action in the section header that opens a modal with a text representation of the full hierarchy
- [x] Parse indentation and bullets into the same underlying three-level topic hierarchy used by the visual editor
- [x] Validate malformed outlines and reject hierarchy deeper than three levels with clear feedback
- [x] Make destructive full-outline replacement explicit before overwriting existing structure
- [x] Apply the same server-side authorization rules to bulk replacement
- [x] Add tests for parsing, depth validation, ordering, hierarchy mutations, deletion behavior, and authorization

### Phase 9C — Course Creation UX

- [x] Keep the existing course creation flow and replace only the initial topic/subtopic input experience
- [x] Rename the field conceptually to `Course outline (optional)` and explain that users can paste a syllabus/course/chapter outline or leave it blank
- [x] Accept natural indented/bulleted outlines instead of requiring `Topic > Subtopic` syntax
- [x] Reuse the same parsing and hierarchy domain logic as the bulk outline editor
- [x] Continue allowing course creation with no manually supplied outline
- [x] Document a clean later path for generating a suggested editable outline from useful processed course material
- [x] Do not present an LLM-generated outline as an official course structure when no authoritative material supports it
- [x] Do not overbuild material-driven outline generation into course creation before the ingestion lifecycle supports it cleanly
- [x] Add tests covering blank outlines, natural outline parsing, validation, and three-level persistence

### Phase 9D — Adaptive Micro-Lessons

- [ ] Before implementation, propose the exact Pydantic/TypeScript structured micro-lesson schema plus API and database migration impact for review
- [ ] Preserve the existing recommended-topic/choose-another-topic/Start Session entry flow unless inspection identifies a strong reason to change it
- [ ] Automatically begin/generate the lesson after Start Session with essentially no additional setup friction
- [ ] Remove the student-facing difficulty selector, Foundation/Standard/Challenge choice, Generate Question button, and practice-question framing
- [ ] Make CadeBit choose internal difficulty from system mastery, prior assessment evidence, current-session performance, and topic history where appropriate
- [ ] Model a session as an adaptive teaching sequence (teach → ask → explain → extend → ask → explain), not a fixed question/answer loop
- [ ] Define a typed `MicroLesson` contract with topic, learning objective, estimated minutes, and structured blocks
- [ ] Support only the initial block types needed now: explanation, example, and MCQ; leave diagrams, interactive equations, simulations, and remedial insertion extensible but unimplemented
- [ ] Render structured lesson blocks in the frontend instead of one unstructured Markdown payload
- [ ] Use MCQs as the primary/only graded V1 interaction and remove normal-flow free-response typing
- [ ] Generate application/reasoning/conceptual questions that build on instruction and avoid trivial recall
- [ ] Require plausible distractors and retain structured misconception information where feasible
- [ ] After each answer, show correctness, concise instructional reasoning, and relevant misconception feedback, then continue the lesson
- [ ] Implement the simplest sound V1 adaptation: incorrect answers can trigger targeted clarification or simpler application; correct answers can continue or increase challenge
- [ ] Reuse authorization-aware course retrieval and do not add unnecessary agent complexity
- [ ] Persist graded MCQ interactions as assessment evidence and update system mastery from that evidence
- [ ] Do not infer mastery from viewing explanation/example blocks, and keep system mastery separate from self-confidence
- [ ] Extend evaluation for grounding, lesson coherence, instructional usefulness, question relevance, application/reasoning quality, distractor quality, grading correctness, and appropriate difficulty/adaptation
- [ ] Preserve deterministic retrieval evaluations and useful existing question/grading evaluation coverage
- [ ] Add contract, orchestration, persistence, mastery, authorization, and end-to-end tests for the micro-lesson flow

### Phase 9E — CadeBit AI

- [ ] Add a secondary `CadeBit AI` course-header action alongside `Course materials`
- [ ] Open a course-specific chat modal or drawer rather than a permanent course-page form or site-wide floating bubble
- [ ] Accept a natural-language student message without task/action selectors
- [ ] Remove manual topic-scope selection and infer retrieval context from the message and authorized course material
- [ ] Reuse the existing grounded RAG and source metadata infrastructure
- [ ] Support follow-up questions with course-scoped conversation context rather than one-shot generation
- [ ] Surface useful material/page/section source references for grounded answers
- [ ] Preserve authorization boundaries for every message and retrieval operation
- [ ] Do not update system mastery from normal CadeBit AI conversation
- [ ] Add typed conversation/message contracts, persistence only if justified by the approved V1 design, safe error handling, and relevant tests

### Phase 9 Cross-Cutting Requirements

- [ ] Keep the primary course page focused on learning and progress; place infrequent management actions behind small, obvious modal/drawer actions
- [ ] Preserve shared versus independent course semantics, server-side authorization, per-user schedules, and system-mastery/self-confidence separation
- [ ] Reuse existing material ingestion, RAG, source metadata, assessment evidence, and mastery capabilities instead of rebuilding them
- [ ] Keep API contracts typed and validated across Next.js/TypeScript and FastAPI/Pydantic
- [ ] Preserve detailed operational errors in logs while returning concise, safe student-facing messages
- [ ] Update tests whenever behavior, persistence, permissions, or service contracts change
- [ ] Avoid new dependencies, distributed/background architecture, and agent complexity without a clear product need
- [ ] Preserve the minimal white/black/gray visual language and do not redesign unrelated application areas
- [ ] Do not expose backend/provider concepts in the student UI when CadeBit can infer or manage them
- [ ] Continue deferring browser extension, mobile, push notification, and email-delivery work

## Phase 10 — Product / Reliability

- [ ] Add robust error states
- [ ] Add loading/empty states
- [ ] Add structured application logs
- [ ] Add error monitoring
- [ ] Track AI latency
- [ ] Track AI token/model usage
- [ ] Add retry strategy for background work
- [ ] Add background queue only when needed
- [ ] Add end-to-end tests for critical flows
- [ ] Review accessibility
- [ ] Review security/privacy basics

## Phase 11 — Deployment

- [ ] Deploy web app
- [ ] Deploy FastAPI service
- [ ] Provision managed PostgreSQL
- [ ] Provision object storage
- [ ] Configure production secrets
- [ ] Add CI/CD
- [ ] Add production logging/monitoring
- [ ] Run end-to-end production smoke test

## Deferred

Do not work on these until the core product is solid:

- [ ] Email TLDR / scheduled email notifications
- [ ] Browser extension
- [ ] Mobile app
- [ ] Push/mobile notifications

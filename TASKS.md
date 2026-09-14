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

## Phase 9 — Product / Reliability

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

## Phase 10 — Deployment

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

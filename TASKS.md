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

- [ ] Set up PostgreSQL
- [ ] Define users
- [ ] Define courses
- [ ] Define course memberships
- [ ] Define admin/member roles
- [ ] Define topics
- [ ] Define subtopic hierarchy
- [ ] Define materials
- [ ] Define course-material associations
- [ ] Define per-user topic progress
- [ ] Define AI assessment evidence
- [ ] Define user self-assessment
- [ ] Define study sessions
- [ ] Define activity/time-spent tracking
- [ ] Define streak derivation strategy
- [ ] Define user-specific schedules / target dates
- [ ] Define independent/private course behavior
- [ ] Add migrations
- [ ] Add authorization tests

## Phase 3 — Course Management

- [ ] Create/join course
- [ ] Admin can edit topic structure
- [ ] Members can view shared structure
- [ ] Members cannot modify canonical structure
- [ ] User can create a private independent course
- [ ] User can change their own target completion date
- [ ] User schedule changes do not alter other members
- [ ] Track topic/subtopic completion
- [ ] Track user confidence/self-assessment
- [ ] Track study activity

## Phase 4 — FastAPI AI Service

- [ ] Add health endpoint
- [ ] Define service configuration
- [ ] Add OpenAI client abstraction
- [ ] Define web-app-to-AI-service API contract
- [ ] Add structured logging
- [ ] Add service tests
- [ ] Add failure/timeout handling

## Phase 5 — Course Material Ingestion

- [ ] Add course material upload flow
- [ ] Add object storage
- [ ] Store material metadata in PostgreSQL
- [ ] Parse supported documents
- [ ] Normalize extracted text
- [ ] Chunk material
- [ ] Preserve source/page/section metadata
- [ ] Generate embeddings
- [ ] Add pgvector
- [ ] Store embeddings
- [ ] Make ingestion idempotent
- [ ] Handle failed ingestion

## Phase 6 — RAG

- [ ] Implement permission-aware retrieval
- [ ] Filter retrieval by authorized course/material
- [ ] Add optional topic/subtopic filtering
- [ ] Return source metadata with retrieval results
- [ ] Build grounded Q&A
- [ ] Build grounded explanation generation
- [ ] Build grounded summaries
- [ ] Surface source references in UI
- [ ] Add retrieval latency/token logging

## Phase 7 — Adaptive Study

- [ ] Generate practice questions
- [ ] Support structured answer grading
- [ ] Store assessment evidence
- [ ] Derive initial mastery/confidence signal
- [ ] Keep AI assessment separate from self-assessment
- [ ] Recommend next topic
- [ ] Incorporate schedule/deadline pressure
- [ ] Create basic adaptive study session flow
- [ ] Update progress after study activity

## Phase 8 — Evaluation

- [ ] Build labeled retrieval evaluation set
- [ ] Measure Recall@K
- [ ] Measure Precision@K
- [ ] Measure ranking/MRR where useful
- [ ] Add grounding checks
- [ ] Evaluate generated-question quality
- [ ] Evaluate grading consistency
- [ ] Add regression evaluation command
- [ ] Record model/prompt configuration in eval outputs

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

# CadeBit

CadeBit is a learning platform that turns course material into an
adaptive study system. The goal is to build a polished product for real
students---not just a demo---where users can organize courses, study
from course-specific material, track mastery, and receive AI-generated
learning experiences grounded in the material they are actually
responsible for.

This document reflects the current project direction. Features
intentionally deferred are listed near the end.

## 1. Product Goal

CadeBit should help a student answer:

-   What am I supposed to know?
-   What should I study next?
-   How well do I actually know each topic?
-   Am I on pace for my target completion/exam date?
-   Can I learn through a useful adaptive micro-lesson or ask a natural
    follow-up question grounded in my course material?

The product should support both:

1.  **Shared/group courses** --- multiple students studying the same
    course structure and reusable material.
2.  **Independent courses** --- a private course/syllabus created for
    one student's needs.

The architecture should be production-minded: authenticated users,
persistent data, permissions, reusable course knowledge, reliable AI
retrieval, evaluation, observability, and deployable services.

------------------------------------------------------------------------

## 2. Current Scope

### Build now

-   Web application
-   User authentication and accounts
-   Courses and course groups
-   Topics and subtopics
-   Course materials
-   Student progress/mastery tracking
-   Study schedule and target dates
-   Time-spent and streak tracking
-   AI-generated, course-grounded micro-lessons and a secondary
    course-specific assistant
-   RAG over course material
-   Agentic study workflows where they provide real product value
-   Backend APIs
-   PostgreSQL data model
-   Vector search / embeddings
-   Production deployment
-   Testing, logging, monitoring, and evaluation

### Explicitly deferred

For now, do **not** spend development time on:

-   Browser extension
-   Mobile app
-   Push/mobile notifications

**Email notifications / daily TLDR delivery come last**, after the core
web product works well.

------------------------------------------------------------------------

## 3. Core Product Model

The conceptual data split is **GLOBAL/shared data** versus
**user/course-local data**. This is a useful product boundary, although
it does not necessarily mean separate databases.

### Global / reusable data

#### Users

Account-level identity and authentication information.

#### Course Groups

A shared course instance that multiple users can join.

Examples:

-   UIUC ECE 313 --- Fall 2026
-   A study group following a common syllabus

A group has members and roles.

#### Reusable Course Material

Material that can be shared/reused independently of a particular group.

This should remain separate from a course group because:

-   multiple groups may use the same source material;
-   a student may study independently using similar material;
-   two course instances may cover slightly different topics or
    schedules despite sharing sources.

Possible material:

-   syllabus
-   lecture slides
-   notes
-   textbook excerpts/references
-   assignments
-   study guides
-   instructor-provided documents
-   other uploaded resources

Material is also the primary source corpus for RAG.

------------------------------------------------------------------------

## 4. Course-Level Data

A course can be a shared/group course or an independent/private course.

### Course

Contains:

-   name
-   description
-   owner/admin
-   members
-   member roles
-   topic hierarchy
-   associated course materials
-   shared course configuration
-   associated per-user schedules and target completion/exam dates
-   progress configuration

A course with only one member can simply have that user as its admin.

### Roles

At minimum:

-   **Admin**
-   **Member**

Admins can modify shared course structure such as topics/subtopics and
course configuration.

Members should not be able to silently modify the canonical structure
for everyone.

### Topics and Subtopics

Courses currently support a maximum of three semantic levels: topic,
subtopic, and sub-subtopic. The structure should be displayed and edited as a
visual ordered outline rather than as a collection of parent-selection forms.
For example:

``` text
ECE 313
├── Probability Foundations
│   ├── Sample Spaces
│   ├── Conditional Probability
│   └── Bayes' Rule
├── Random Variables
│   ├── PMFs
│   ├── PDFs
│   └── CDFs
└── ...
```

Topics/subtopics become the organizing units for:

-   progress
-   mastery/confidence
-   AI retrieval
-   adaptive micro-lessons and graded interactions
-   study scheduling
-   completion
-   analytics

Each outline item has a stable sibling position and may have optional context
or description metadata for retrieval and generation. That context is edited
on demand and does not need to occupy permanent space in the visible outline.
Course creation and the bulk editor should share one parser for natural
indented/bulleted outlines, including validation of the three-level limit.
Creating a course without an outline remains valid. A future material-derived
outline must be presented as an editable suggestion unless authoritative
course material supports treating it as canonical. The clean implementation
path is to create the course first, ingest and process its material, generate a
suggestion from the authorized processed corpus, and let an admin review and
confirm it through the existing outline editor rather than blocking course
creation on document processing.

### Independent Course

A user can create a private course and syllabus that does not need to
become global/shared data.

This allows CadeBit to work even when no existing course group exists.

------------------------------------------------------------------------

## 5. User Learning State

Each user needs personalized state layered on top of a course.

### Membership

Tracks which courses a user belongs to and their role.

### Mastery / Confidence

Track confidence at course, topic, and subtopic levels.

Two signals are useful:

1.  **AI/system assessment**
2.  **User self-assessment**

The user's disagreement with the AI should not destroy the model's
assessment. Store the signals separately so the UI and scheduling logic
can use both.

Possible inputs to system mastery:

-   quiz correctness
-   question difficulty
-   repeated performance
-   recency
-   hints used
-   time to answer
-   review performance

Do not lock the exact mastery formula too early. Preserve the raw
evidence needed to improve it later.

### Completion

Track completed topics/subtopics separately from confidence where
useful.

"Completed" and "mastered" are not the same thing.

### Schedule

A user can have a personalized schedule even inside a shared course.

Example:

> Finish ECE 313 two weeks earlier.

Changing that target should recompute that user's study plan without
changing everyone else's course schedule.

### Time Spent

Track study activity at useful granularity:

-   overall
-   course
-   topic/subtopic
-   study session

### Streaks

Support:

-   overall streak
-   course-specific streak

Streaks should ultimately derive from activity records rather than
existing only as mutable counters.

### Leaderboard

Shared courses may expose a leaderboard.

Solo courses do not need one.

Leaderboard metrics should be designed carefully so CadeBit rewards
productive learning rather than meaningless app usage.

------------------------------------------------------------------------

## 6. Web App / UI Direction

The web app is the primary product surface.

The design direction discussed so far is a dashboard-oriented student
experience with navigation around courses, progress, schedules, and
learning activity.

Likely primary surfaces:

### Dashboard

At-a-glance:

-   today's study plan
-   current courses
-   progress
-   streak
-   upcoming targets
-   recommended next action

### Course Page

The course page is primarily a learning and progress workspace, not a
permanent administration screen. It should emphasize:

-   progress
-   an ordered three-level topic outline
-   schedule
-   the user-specific target date
-   starting an adaptive micro-lesson
-   mastery/confidence
-   group information where applicable

Infrequent actions should remain discoverable without occupying the main page.
The target-date summary card opens a small editor modal. Course materials and
the course-specific CadeBit AI assistant are header actions that open
modal/drawer interfaces. Material management includes existing status, upload,
and authorized deletion. Topic administration uses direct item actions and an
optional bulk outline editor. Provider/server error details are logged, not
shown to students.

### Topic / Study Experience

A focused guided micro-lesson surface that can interleave:

-   concise concept instruction and intuition
-   worked reasoning/examples
-   application-oriented multiple-choice questions
-   concise answer feedback and misconception correction
-   extensions or targeted clarification based on performance

After a student selects a recommended or alternate topic and starts a session,
the lesson should begin without a student-facing difficulty choice or separate
question-generation step. Difficulty is an internal adaptive concern. Lesson
content uses a typed block contract rather than one large Markdown string, and
only graded interactions produce system-mastery evidence.

#### Phase 9D micro-lesson design

`POST /v1/micro-lessons` generates one grounded lesson for an authorized user,
course, and selected topic scope. The selected outline node bounds retrieval,
but the generated `learning_objective` must be narrow enough for one short,
coherent lesson rather than attempting to cover a broad topic comprehensively.
Repeated lessons gradually cover the wider hierarchy.

The internal Pydantic contract and its TypeScript mirror use a discriminated
`blocks` array:

-   `MicroLesson`: topic reference, narrow `learning_objective`,
    `estimated_minutes`, internal `target_difficulty`, and `blocks`
-   `explanation`: stable block ID, optional heading, and instructional body
-   `example`: stable block ID, optional heading, scenario, reasoning steps,
    and takeaway
-   `mcq`: stable block ID, prompt, exactly four choices, private correct-choice
    ID, private lesson explanation, internal difficulty, and choices whose
    private feedback may include a misconception

A valid lesson contains at least one instructional block (`explanation` or
`example`) and at least one MCQ. Examples are optional, block order remains
instructionally flexible, and no fixed explanation/example/question sequence
is required. Diagrams, interactive equations, simulations, and dynamically
inserted remedial blocks remain future extensions rather than Phase 9D block
types.

Generation is one-shot in V1. A named, configurable heuristic combines system
mastery and recent graded performance into a bounded target difficulty; it is
not a learned or calibrated model. Choice-specific feedback is generated with
the lesson so an incorrect answer can receive targeted correction without a
new model call. Deterministic tests protect the heuristic and its bounds.

The browser receives a safe progressive projection of the canonical lesson.
Blocks render inline as one continuous lesson, but projection stops at the
first unanswered MCQ. Before submission the client never receives its correct
choice ID, explanation, misconception metadata, choice feedback, or any later
blocks. The server grades the selected choice against the canonical lesson,
then reveals correctness, the lesson explanation, only the selected choice's
feedback/misconception when applicable, and the following blocks inline up to
the next unanswered MCQ.

The database stores generated content once in `micro_lessons.blocks` JSONB,
along with its objective, topic/course/user/session ownership, difficulty,
sources, and generation metadata. `micro_lesson_answers` records student
behavior only: lesson, user, block ID, selected choice ID, correctness, and
answer time. It does not duplicate generated feedback. Each deterministically
graded MCQ creates raw assessment evidence and can update system mastery;
viewing instructional blocks does neither. Existing practice-question records
and evaluation history remain intact.

The initial API/database impact is additive: a new micro-lesson endpoint and
the two tables above. Existing study-session ownership, shared-course
authorization, topic isolation, retrieval/source metadata, and the separation
between system mastery and self-confidence continue to apply. Phase 9D uses
the existing unit/integration infrastructure and explicit browser verification;
general end-to-end browser infrastructure remains Product / Reliability work.

Course-specific grounded Q&A remains available as the secondary **CadeBit AI**
chat interface. It infers intent and retrieval scope from natural language,
supports follow-up questions, and surfaces source references. Ordinary chat
messages and reading explanations do not update mastery.

### Course Management

For admins:

-   manage members
-   manage topic hierarchy
-   attach/manage material
-   configure shared course information

### Account / Settings

User/account preferences and eventually notification preferences.

The frontend should feel like a real consumer SaaS product, not an admin
panel wrapped around an LLM.

------------------------------------------------------------------------

## 7. AI Architecture

AI should be part of the learning system rather than a generic chatbot
bolted onto the app.

There are two related concepts:

-   **RAG** provides grounded course knowledge.
-   **Agentic workflows** decide what actions/tools to use to complete a
    learning task.

### RAG Pipeline

High-level flow:

``` text
Course material
      ↓
Parse / normalize
      ↓
Chunk
      ↓
Metadata enrichment
      ↓
Embeddings
      ↓
Vector index
      ↓
Retrieve relevant chunks
      ↓
Optional reranking/filtering
      ↓
LLM + retrieved evidence
      ↓
Grounded learning response
```

Each chunk should retain metadata such as:

-   source/material ID
-   course/material association
-   page/section
-   topic/subtopic where known
-   document type
-   chunk position

This lets the system filter retrieval and provide useful source
references.

### Retrieval

A request should not search every document in CadeBit.

Retrieval needs permission-aware scoping such as:

``` text
user
  → authorized course
  → relevant material
  → topic/subtopic filter when useful
  → semantic retrieval
  → response
```

This is both a relevance and security requirement.

### Agentic AI

Use agents/workflows when a task genuinely requires multiple decisions
or tools.

Example adaptive study flow:

``` text
Student starts study session
        ↓
Read course + user state
        ↓
Determine weak / due / important topics
        ↓
Retrieve relevant course material
        ↓
Generate a structured micro-lesson
        ↓
Teach → ask → explain → extend
        ↓
Evaluate graded MCQ response
        ↓
Update learning evidence
        ↓
Continue, clarify, or increase challenge
```

Potential AI tools:

-   retrieve course material
-   fetch topic hierarchy
-   read user mastery
-   read schedule/deadlines
-   generate structured explanation/example/MCQ blocks
-   grade structured MCQ answers
-   record assessment evidence
-   recommend next topic
-   adjust a personalized study plan

Avoid making every LLM call an "agent." Simple deterministic workflows
should remain normal application code.

------------------------------------------------------------------------

## 8. AI Evaluation

Because CadeBit relies on retrieval and generated learning content,
evaluation should be a first-class engineering concern.

### Retrieval Evaluation

Create a small labeled evaluation set of questions where the expected
supporting chunks/documents are known.

Track metrics such as:

-   Recall@K
-   Precision@K
-   MRR / ranking quality
-   whether the required source appeared in retrieved context

### Generation Evaluation

Evaluate:

-   factual grounding in retrieved material
-   relevance
-   completeness
-   unsupported claims
-   citation/source correctness
-   lesson coherence and instructional usefulness
-   application/reasoning and question relevance
-   distractor and misconception quality
-   grading consistency
-   appropriate difficulty and adaptation

Maintain regression tests so retrieval/prompt/model changes can be
compared rather than judged only by feel.

------------------------------------------------------------------------

## 9. Proposed Technical Stack

The stack is intentionally practical and gives the project meaningful
full-stack, backend, AI, database, and cloud engineering depth without
forcing technologies purely for resume keywords.

### Frontend

-   **Next.js**
-   **React**
-   **TypeScript**
-   Tailwind CSS
-   component library as appropriate

Responsibilities:

-   web UI
-   routing
-   authenticated product experience
-   dashboards/course pages
-   server/client rendering where appropriate
-   calls to backend services

### Core Application Backend

The web application needs a conventional backend/API layer for:

-   users
-   courses
-   memberships
-   topics
-   progress
-   schedules
-   permissions
-   material metadata
-   study activity

This can live in the Next.js/backend ecosystem where it makes sense.

### Python AI Service

Use **Python + FastAPI** as a separate service for AI/ML-heavy
functionality.

FastAPI is useful because CadeBit's AI pipeline will naturally use
Python libraries.

Responsibilities can include:

-   document ingestion
-   parsing/chunking
-   embedding generation
-   retrieval
-   reranking
-   RAG orchestration
-   structured micro-lesson generation
-   MCQ answer evaluation/grading and misconception feedback
-   course-specific assistant generation
-   mastery-related ML/heuristics
-   AI evaluation jobs

Conceptually:

``` text
Next.js Web App
      │
      ├── application/database operations
      │
      └── HTTP/API
             ↓
       FastAPI AI Service
             │
       ┌─────┴─────┐
       ↓           ↓
   PostgreSQL     LLM API
   / vectors
```

The point of FastAPI is **not** to split the backend merely to claim
microservices. It gives the Python AI subsystem a clean boundary while
the rest of the product remains straightforward.

### Database

**PostgreSQL**

Use relational tables for core application state.

Likely entities include:

-   users
-   courses
-   course_memberships
-   topics
-   materials
-   material-course relationships
-   user_topic_progress
-   assessments
-   study_sessions
-   schedules / schedule items
-   activity events

### Vector Search

Start with **pgvector** in PostgreSQL unless scale or retrieval
requirements justify a dedicated vector database later.

Benefits:

-   fewer moving pieces
-   relational metadata and vectors close together
-   straightforward filtering by course/material/topic
-   enough capability for the initial product

### AI / LLM

Use the **OpenAI API** for model and embedding capabilities where
appropriate.

Keep model access behind an application abstraction so prompts, models,
evaluation, and providers can evolve without leaking implementation
details throughout the codebase.

### Background Work

Document ingestion and other expensive tasks should not block normal web
requests.

Examples:

-   parsing uploads
-   chunking
-   embedding
-   bulk AI generation
-   evaluation runs

Introduce a queue/background-worker system when these workflows require
it rather than prematurely building distributed infrastructure.

### Storage

Uploaded original course documents should live in object/blob storage
rather than directly in PostgreSQL.

PostgreSQL stores metadata and references to the objects.

------------------------------------------------------------------------

## 10. Service Boundaries

A useful initial architecture is a **modular application plus one
focused Python AI service**, not a fleet of microservices.

``` text
┌─────────────────────────────────────────────┐
│                 Web Browser                 │
└─────────────────────┬───────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────┐
│          Next.js / React Web App            │
│                                             │
│ UI • Auth • Product APIs • Permissions      │
│ Courses • Progress • Schedules • Groups     │
└──────────────┬──────────────────┬───────────┘
               │                  │
               ↓                  ↓
      ┌────────────────┐   ┌─────────────────┐
      │   PostgreSQL   │   │ FastAPI AI      │
      │   + pgvector   │←──│ Service         │
      └────────────────┘   └────────┬────────┘
               ↑                    │
               │                    ↓
      ┌────────────────┐   ┌─────────────────┐
      │ Object Storage │   │ OpenAI / Models │
      └────────────────┘   └─────────────────┘
```

Asynchronous workers can be added around ingestion/evaluation when
needed.

------------------------------------------------------------------------

## 11. Authentication and Authorization

Authentication identifies the user.

Authorization determines what the user can access or modify.

Important checks include:

-   user can access the requested course;
-   member can read shared course content;
-   only admins can modify canonical course structure;
-   users can only modify their own progress/self-assessment/schedule;
-   retrieval can only use material the user is authorized to access.

Authorization must be enforced server-side, not only by hiding UI
controls.

------------------------------------------------------------------------

## 12. Suggested Repository Structure

A monorepo is a reasonable starting point.

``` text
cadebit/
├── apps/
│   └── web/                 # Next.js web app
├── services/
│   └── ai/                  # FastAPI Python service
│       ├── app/
│       │   ├── api/
│       │   ├── rag/
│       │   ├── ingestion/
│       │   ├── evaluation/
│       │   ├── learning/
│       │   └── main.py
│       └── tests/
├── packages/
│   └── ...                  # shared TS packages if needed
├── infra/
│   └── ...                  # deployment/infrastructure config
├── docs/
│   └── ...                  # architecture/design docs
├── PROJECT.md
└── README.md
```

Do not create abstractions/packages merely because the directory exists.
Add shared packages when real reuse appears.

------------------------------------------------------------------------

## 13. API Direction

The product should expose clean REST-style interfaces between services.

Example application endpoints:

``` text
GET    /courses
POST   /courses
GET    /courses/{course_id}
POST   /courses/{course_id}/members
GET    /courses/{course_id}/topics
POST   /courses/{course_id}/topics

GET    /courses/{course_id}/progress
PATCH  /topics/{topic_id}/self-assessment

POST   /study-sessions
PATCH  /study-sessions/{id}
```

Example FastAPI AI endpoints:

``` text
POST /ingest
POST /retrieve
POST /answer
POST /micro-lessons
POST /micro-lessons/{id}/answers
POST /course-assistant/messages
POST /study/recommend-next
```

These are directional, not a frozen API contract.

------------------------------------------------------------------------

## 14. Deployment / Hosting Direction

Deploy the system as real internet-facing software rather than keeping
it as a local demo.

The deployment should provide:

-   web hosting for Next.js
-   a containerized FastAPI service
-   managed PostgreSQL
-   object storage
-   secrets/environment management
-   logs/monitoring
-   CI/CD from GitHub

Keep the first production deployment simple. Do not introduce Kubernetes
solely for the sake of using Kubernetes.

Docker is useful for reproducible local and deployed service
environments, particularly for the FastAPI service.

Cloud/hosting choices should optimize for:

1.  reliable deployment,
2.  low student-project cost,
3.  good developer experience,
4.  enough production realism to demonstrate actual backend/cloud
    engineering.

The exact provider can remain replaceable until implementation requires
a provider-specific decision.

------------------------------------------------------------------------

## 15. Engineering Quality

CadeBit is intended to be a polished software product serving actual
users, so the project should include more than feature code.

### Testing

-   frontend/component tests where valuable
-   backend unit tests
-   API/integration tests
-   permission tests
-   RAG/retrieval evaluation suite
-   end-to-end tests for critical user flows

### Observability

At minimum:

-   structured logs
-   request/error tracking
-   AI latency
-   token/model usage
-   retrieval latency
-   ingestion failures

Later:

-   traces across web → AI service → database/model
-   product analytics

### Reliability

Design for:

-   failed uploads
-   duplicate ingestion
-   LLM/API failures
-   retryable background jobs
-   idempotent processing where appropriate
-   partial AI outages without corrupting user data

------------------------------------------------------------------------

## 16. Security / Privacy Basics

Course material and student progress can be private.

Required principles:

-   server-side authorization
-   secure authentication/session handling
-   scoped retrieval
-   validate uploads
-   secrets only in server environments
-   never expose model/API keys to the browser
-   minimize unnecessary personal data
-   clearly distinguish shared and private course resources

------------------------------------------------------------------------

## 17. What We Are Deliberately Avoiding

CadeBit should demonstrate serious engineering without becoming a
resume-keyword collection.

Do not add technology without a product/engineering reason.

Examples:

-   no Kubernetes until deployment complexity warrants it;
-   no dozens of microservices;
-   no dedicated vector database until pgvector becomes limiting;
-   no "agent" around every model call;
-   no blockchain;
-   no complex distributed system just to say the project is
    distributed;
-   no mobile/extension work while the core product is unfinished.

Technologies like MCP can be considered later if CadeBit develops a
genuine need to expose or consume standardized external tools/context.
It is not currently a requirement.

------------------------------------------------------------------------

## 18. Development Priorities

A reasonable implementation order:

1.  **Project foundation**
    -   repo structure
    -   Next.js app
    -   PostgreSQL
    -   authentication
    -   local development setup
2.  **Core course model**
    -   users
    -   courses
    -   memberships/roles
    -   topics/subtopics
    -   basic course UI
3.  **Learning state**
    -   progress
    -   confidence/self-assessment
    -   study activity
    -   target dates/schedules
4.  **FastAPI AI service**
    -   service skeleton
    -   health/API contract
    -   connection to web app
    -   model client abstraction
5.  **Course material ingestion**
    -   uploads
    -   object storage
    -   parsing
    -   chunks
    -   embeddings
    -   pgvector
6.  **RAG study features**
    -   retrieval
    -   grounded Q&A/explanations
    -   summaries
    -   source references
7.  **Adaptive learning**
    -   structured micro-lessons
    -   application-oriented MCQs and grading
    -   assessment evidence
    -   next-topic recommendation
    -   mastery updates
8.  **Evaluation**
    -   retrieval test set
    -   lesson, question, grading, and assistant quality checks
    -   regression evaluation
9.  **Product experience revision**
    -   learning-focused course page and modal/drawer management actions
    -   ordered three-level course outline and shared outline parsing
    -   adaptive micro-lesson experience
    -   course-specific CadeBit AI chat
10. **Production hardening**
    -   tests
    -   observability
    -   queues/workers where necessary
    -   CI/CD
    -   deployment
    -   performance/security cleanup
11. **Email TLDR / notifications**
    -   only after the core experience is solid
12. **Future surfaces**
    -   browser extension
    -   mobile app
    -   push notifications

------------------------------------------------------------------------

## 19. Longer-Term Product Ideas

These are part of the broader CadeBit vision but are not current
implementation priorities.

### Daily TLDR

At a chosen time, generate a short review of material covered that
day---roughly something a student could read during a bus ride home.

Eventually delivery could include email and other channels.

### Doomscroll Interruption Browser Extension

A user selects distracting sites and an interval.

After spending a configured amount of time on one of those sites,
CadeBit opens a short learning interruption such as:

-   quick lesson
-   recall question
-   review prompt

After completing it, the user returns to what they were doing.

This is conceptually connected to CadeBit's course/progress system but
intentionally deferred.

### Mobile Experience

A future mobile app could provide study sessions, quick reviews, and
notifications using the same backend learning state.

------------------------------------------------------------------------

## 20. Project Success Criteria

CadeBit is successful as an engineering project when a real student can:

1.  create an account;
2.  create or join a course;
3.  see a meaningful topic hierarchy;
4.  upload/use course material;
5.  study through an adaptive micro-lesson grounded in that material;
6.  complete low-friction, instructionally relevant graded questions;
7.  build a persistent mastery profile;
8.  see what to study next and why;
9.  adjust a target date and receive an updated plan;
10. return later and continue from persistent state.

It is successful as a **product** when those capabilities form a fast,
understandable, trustworthy experience students would actually choose to
keep using.

------------------------------------------------------------------------

## 21. Current Architecture Principle

The guiding architecture principle is:

> **Keep ordinary product logic deterministic, use retrieval to give AI
> the right course context, and use agentic behavior only where adaptive
> multi-step decision-making improves the student's learning
> experience.**

Build the smallest architecture that can serve real users well, measure
it, and add complexity only when the product creates a reason for it.

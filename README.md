# RepoLens

A tool that helps engineers understand and plan changes in unfamiliar codebases. Four features, no more: repository import, AI-generated repo understanding, repo chat, and implementation planning (plans only, never generated code).

## Status

**All milestones M0–M8 are complete.** RepoLens is production-ready.

## Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand
- **Backend:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2
- **Data:** Neon (Postgres + pgvector), Upstash (Redis)
- **Queue:** ARQ on Upstash Redis
- **AI:** OpenAI API, Tree-sitter
- **Auth:** Clerk
- **Hosting:** Vercel (web), Render (api + workers)

## Repository layout

```
apps/web        Next.js frontend
apps/api        FastAPI backend
workers/        ARQ background workers
packages/db     shared DB kernel (SQLAlchemy models + session)
packages/prompts Jinja2 prompt templates
docs/adr/       architecture decision records
docs/deployment/ deployment checklists
docs/postmortem/ project retrospective & demo guide
```

`apps/api` and `workers/` are peers: both depend on `packages/db`, neither depends on the other.

## Quick Start (Native)

```bash
# 1. Install dependencies
make sync

# 2. Copy and fill environment variables
cp .env.example .env

# 3. Run all services
make api    # Terminal 1
make web    # Terminal 2
make worker # Terminal 3
```

## Quick Start (Docker)

```bash
# 1. Copy and fill environment variables
cp .env.docker .env

# 2. Start all services
make docker-up

# 3. Run migrations (first time only)
make docker-migrate
```

Services will be available at:
- **API:** http://localhost:8000
- **Web:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs

## Deployment

See [docs/deployment/checklists.md](docs/deployment/checklists.md) for step-by-step deployment to Vercel, Render, Neon, and Upstash.

## Milestones

- [x] M0: Architecture — docs, ADRs, folder structure, secrets contract
- [x] M1: Authentication — Users, Projects, Dashboard (Clerk)
- [x] M2: Repository upload — Clone, Metadata, DB
- [x] M3: Worker — Queue, Status, Progress (ARQ)
- [x] M4: Embedding — Chunking, Vector, Search (pgvector)
- [x] M5: AI Summary — Architecture, Tech stack, Entry points
- [x] M6: Chat — Streaming, History
- [x] M7: Implementation Planner
- [x] M8: Polish — Animations, Tests, Deployment

# RepoLens

A tool that helps engineers understand and plan changes in unfamiliar codebases. Four features, no more: repository import, AI-generated repo understanding, repo chat, and implementation planning (plans only, never generated code).

## Status

Foundation milestone (M0) — monorepo skeleton, workspace manifests, secrets contract, and architecture docs. No runnable application code yet.

## Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand
- **Backend:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2
- **Data:** Neon (Postgres + pgvector), Upstash (Redis)
- **Queue:** ARQ on Upstash Redis
- **AI:** OpenAI API, Tree-sitter
- **Auth:** Clerk
- **Hosting:** Vercel (web), Render (api + workers)

## Repository layout

    apps/web        Next.js frontend
    apps/api        FastAPI backend
    workers/        ARQ background workers
    packages/db     shared DB kernel (SQLAlchemy models + session) — peer to apps/api and workers/
    docs/adr/       architecture decision records

`apps/api` and `workers/` are peers: both depend on `packages/db`, neither depends on the other. See ADR 0001.

## Setup

1. Copy `.env.example` to `.env` and fill in credentials (see ADR 0006 for the per-environment secret supply story).
2. Python workspace: `uv sync` at repo root.
3. Node workspace: `pnpm install` at repo root.

Application code lands in Milestone 1 onward.

## Milestones

0. Architecture — docs, ADRs, folder structure, secrets contract
1. Authentication — Users, Projects, Dashboard (Clerk)
2. Repository upload — Clone, Metadata, DB
3. Worker — Queue, Status, Progress (ARQ)
4. Embedding — Chunking, Vector, Search (pgvector)
5. AI Summary — Architecture, Tech stack, Entry points
6. Chat — Streaming, History
7. Implementation Planner
8. Polish — Animations, Tests, Deployment

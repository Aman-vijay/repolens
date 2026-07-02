# ADR 0001: Monorepo layout, package topology, and dev/prod parity strategy

**Status:** Accepted
**Date:** 2026-07-02

## Context

RepoLens is a polyglot system (TypeScript frontend, Python backend + workers) that must sustain eight sequential feature milestones. Before any feature work, we need (a) a folder structure that gives every future milestone a stable home, (b) a dependency graph that won't rot as workers gain their own libraries, and (c) a dev/prod parity story that doesn't decay.

The original plan containerized Postgres+pgvector and Redis locally and ran apps natively. That was superseded before build: both data stores are now external managed services (Neon, Upstash) from day one, which changes the parity story entirely.

## Decision

### Folder topology

    apps/web        Next.js frontend (Vercel)
    apps/api        FastAPI backend (Render)
    workers/        ARQ background workers (Render)
    packages/db     shared DB kernel — SQLAlchemy models + session/engine
    packages/       reserved for future TS contracts (M1)

### Peer relationship via packages/db

`apps/api` and `workers/` are **peers**. Both depend on `packages/db` for SQLAlchemy models and the engine/session. Neither depends on the other.

### No local infrastructure

- Postgres + pgvector → Neon (managed), dev and prod.
- Redis → Upstash (managed), dev and prod.
- No `docker-compose.yml`; no local DB/Redis containers.
- Apps run natively in dev (`next dev`, `uvicorn --reload`).

### What dev/prod parity means now

The old concern ("local pgvector container may drift from prod pgvector version/extension config") is **gone** — dev and prod both use Neon-managed pgvector, so extension/version drift is Neon's problem, not ours. Parity on the infra axis actually **improved**.

Parity debt now lives on a smaller axis:

- **App runtime:** native dev vs containerized prod (Vercel/Render build images). Closed in M8.
- **Credentials:** dev Neon project vs prod Neon project — same protocol, different DB. Config, not drift.
- **Resource limits:** dev compute < prod compute; behavior must not assume prod capacity.

## Rejected alternatives

- **worker→api coupling** (workers depend on apps/api via path dependency): Rejected because a background job runner would drag in an entire web-facing API package (FastAPI, middleware, route handlers, request/response schemas) just to reach models. This inverts the real dependency, couples the worker's deployable lifecycle to the API's dependency surface, and preloads the worker with FastAPI deps it doesn't need when tree-sitter/embedding libraries arrive in M4/M5. Violates Dependency Inversion — both apps should depend on an abstraction (the data kernel), not one concrete app on another.
- **Full-stack Docker Compose in dev** (web+api+worker+db+redis all containerized): Rejected for DX — rebuilding app images on every code change kills HMR/reload velocity. Strong prod parity, but the wrong trade-off for a feature-building phase.
- **Optional offline-fallback compose** (local pgvector + redis for airgap dev): Rejected for dual-config drift risk — keeping a second infra config in sync with Neon/Upstash costs maintenance for a benefit (offline dev) that doesn't match how this project is actually built.

## Consequences

- +1 package to maintain (`packages/db`).
- One extra workspace wiring step (workspace path deps).
- Clean peer graph; worker free to grow its own dependency surface.
- No offline dev — requires connectivity to Neon/Upstash even on localhost. Accepted.
- Infra-axis parity improved; runtime-axis parity deferred to M8.
- Zero local-infra maintenance burden.

## Revisit trigger

- If the team grows beyond solo and offline/airgapped dev becomes a real need.
- If Neon/Upstash cost or reliability becomes a problem in prod.

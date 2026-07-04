# ADR 0017: ARQ durable queue replacing BackgroundTasks

**Status:** Accepted  
**Date:** 2026-07-04

## Context

Milestone 2 used FastAPI `BackgroundTasks` for the clone+extract job. This is an in-memory, non-durable execution path — if the server restarts, the job is lost. There is no retry, no visibility, and no way to scale workers independently of the API.

Milestone 3 introduces a proper job queue using ARQ on Upstash Redis.

## Decision

Replace `BackgroundTasks` with ARQ:

1. **API enqueues** — `POST /api/projects/{id}/repository` creates the `Repository` row with `status=pending`, `progress=0`, then calls `enqueue_clone(repository_id)` which puts a job on the Redis queue via `arq.create_pool().enqueue_job(...)`.

2. **Worker processes** — A separate ARQ worker process (`workers/worker.py`) connects to the same Redis, dequeues the job, runs `clone_repository(ctx, repository_id)`, and updates the `Repository` row with `progress` at each phase (10 → 40 → 80 → 100).

3. **Worker is a peer process** — Per ADR 0001, `workers/` and `apps/api` are peers. Both depend on `packages/db`. The API does not import from `workers/` — it enqueues by job name string only.

## Why ARQ over alternatives

- **Celery**: Heavier, requires a broker (RabbitMQ or Redis), more configuration. ARQ is async-native and simpler.
- **Dramatiq**: Good alternative, but less async-friendly and no built-in Redis transport.
- **RQ (Redis Queue)**: Sync-only, not compatible with our async SQLAlchemy stack.
- **BackgroundTasks (keep)**: Not durable, no retry, no visibility, no scaling.

## Consequences

- Jobs survive API restarts (stored in Redis until the worker picks them up).
- The worker can be scaled independently (multiple processes, different machines).
- Progress is visible to the client via the existing `GET /api/projects/{id}/repository` endpoint with the new `progress` field.
- `make worker` starts the ARQ worker process locally.
- The old `apps/api/app/services/clone.py` is no longer used by the API — the clone logic lives in `workers/worker.py`.

## Revisit trigger

- If we need job scheduling (cron-like) → ARQ supports `cron` functions.
- If we need job chaining (clone → embed → summarize) → ARQ supports job dependencies.
- If Redis becomes a bottleneck → evaluate a dedicated queue broker.
# ADR 0019: Worker as peer process preserving topology

**Status:** Accepted  
**Date:** 2026-07-04

## Context

ADR 0001 established that `apps/api` and `workers/` are peers — both depend on `packages/db`, neither depends on the other. M3 introduces the first real worker. We must ensure the worker process is a peer, not a child of the API.

## Decision

1. **`workers/` is an installable uv workspace package** (`repolens-workers`) with its own `pyproject.toml`, `[build-system]`, and dependencies (`arq`, `redis`, `structlog`, `python-dotenv`, `repolens-db`).

2. **The worker imports business logic directly** — the clone logic (`_run_git_clone`, `_build_tree`, `_extract_metadata`) lives in `workers/worker.py`, not in a shared package. The API does not import from `workers/`.

3. **The API enqueues by job name string** — `enqueue_clone(repository_id)` calls `arq.pool.enqueue_job("clone_repository", repository_id=...)`. The worker registers `clone_repository` as a function in `WorkerSettings.functions`. There is no code-level coupling.

4. **Shared state is the database** — both the API and worker read/write to the same `repositories` table via `packages/db`. Redis is the job transport, not a shared state store.

5. **`make worker`** starts the ARQ worker process from the repo root.

## Why not move clone logic to a shared package

- The API no longer needs the clone logic (it enqueues, doesn't execute).
- A `packages/services` shared kernel would be cleaner architecturally, but adds a package for one function. If more shared business logic emerges (M4 chunking, M5 summary), we'll create `packages/services` then.
- Duplicating the clone logic in the worker is acceptable because the API's copy (`apps/api/app/services/clone.py`) is now dead code and will be removed.

## Why not have the API call the worker via HTTP

- Breaks the peer topology (API → Worker is a dependency).
- Adds network overhead and error handling for an intra-system call.
- ARQ's Redis-based enqueue is simpler and more durable.

## Consequences

- The worker process can be deployed independently on Render (separate Background Worker service).
- The worker can be scaled horizontally (multiple processes reading from the same Redis queue).
- Dead code in `apps/api/app/services/clone.py` should be cleaned up.
- When M4 adds chunking/embedding, those functions will live in the worker too (or in a new `packages/services` if shared).

## Revisit trigger

- If multiple workers need shared business logic → create `packages/services`.
- If the worker needs to call the API → reconsider the topology (currently worker → DB only).
- If the worker needs to be split into multiple specialized workers → evaluate separate ARQ queues.
# ADR 0013: Clone service — shallow clone + BackgroundTasks (ARQ migration in M3)

**Status:** Accepted  
**Date:** 2026-07-03

## Context

Milestone 2 must clone a repository and extract its metadata. The full ARQ worker pipeline (M3) isn't built yet, so we need a temporary synchronous execution path that is easy to replace.

## Decision

Use a shallow git clone (`git clone --depth 1`) via `asyncio.create_subprocess_exec` and execute it as a FastAPI `BackgroundTasks` job. The API returns `202 Accepted` immediately with `status="cloning"`; the client polls the repository endpoint until `status="ready"` or `status="failed"`.

## Why shallow clone

- `--depth 1` fetches only the latest commit, reducing clone time and disk usage by ~90%.
- Metadata extraction (file tree, languages, counts) only requires the latest state, not history.

## Why BackgroundTasks

- Built into FastAPI; no additional infrastructure needed.
- Runs in the same process, same event loop as the request handler.
- Easy to migrate to ARQ in M3: replace `background_tasks.add_task` with Redis job enqueue.

## Timeout protection

- `asyncio.wait_for(proc.wait(), timeout=30)` kills long-running clones.
- On timeout, status is set to `failed` with an error message.

## Rejected alternatives

- **Synchronous in-request clone**: User waits up to 30s; bad UX and server timeouts.
- **ARQ immediately**: Would require building the full Redis/worker pipeline in M2, breaking milestone scope.

## Consequences

- If the server restarts while a clone is running, the job is lost (BackgroundTasks are in-memory).
- M3 will replace this with ARQ for durability and progress reporting.
- The extraction code (`_extract_metadata`, `_build_tree`) is reusable in M3.

## Revisit trigger

- M3 replaces BackgroundTasks with ARQ.
- If `git` is unavailable on the host → use `dulwich` (pure-Python git) or GitHub archive API.
# ADR 0018: Progress tracking via DB column

**Status:** Accepted  
**Date:** 2026-07-04

## Context

M2's clone job ran as a `BackgroundTask` with no progress feedback — the frontend polled `status` (pending/cloning/ready/failed) but had no granular progress. Users see a spinner with no indication of how far along the clone is.

## Decision

Add a `progress` integer column (0–100) to the `repositories` table. The ARQ worker writes to it at each phase:

| Phase | `progress` | `status` |
|---|---|---|
| Queued | 0 | pending |
| Clone started | 10 | cloning |
| Clone complete, extracting metadata | 40 | cloning |
| Metadata extracted, saving | 80 | cloning |
| Done | 100 | ready |
| Error | (unchanged) | failed |

The frontend `useRepository` hook already polls every 3 seconds during `pending`/`cloning` status. The `Progress` component (Radix UI) renders the value as a bar.

## Why a DB column (not Redis)

- The `Repository` row is the source of truth for repo lifecycle. Progress is part of that lifecycle.
- The frontend already polls the repository endpoint — no new endpoint needed.
- Redis is the job transport, not the application state store. Storing progress in Redis would require a separate read path.
- If the worker restarts mid-job, the DB still shows the last committed progress (not lost).

## Rejected alternatives

- **Redis key per job**: Would work, but adds a second read path and TTL management.
- **WebSocket/SSE push**: Better UX (real-time), but overkill for a 30-second clone job. M5+ can add SSE if needed.
- **No progress (just status)**: Bad UX — users stare at a spinner with no feedback.

## Consequences

- One extra `int` column in the DB (negligible cost).
- The worker commits to the DB at each phase (4 commits per job — acceptable for the clone workload).
- The frontend gets a smooth progress bar with no additional API calls.

## Revisit trigger

- If we need sub-second progress updates → switch to Redis keys + SSE push.
- If progress phases need to be dynamic (not fixed 10/40/80/100) → store phase name too.
# ADR 0005: Queue library: arq (maintenance-mode accepted)

**Status:** Accepted
**Date:** 2026-07-02

## Context

RepoLens needs a background job queue for M3 (repository clone worker), M4 (embedding), and M5 (AI summary). The backend is async-first (FastAPI + SQLAlchemy 2.0 async), so the queue should fit the async model. The queue transport is Upstash Redis (ADR 0004).

## Decision

Use **arq** as the queue library. arq is async-native (built on asyncio), matching FastAPI's async model and our async SQLAlchemy session. Jobs are plain async functions; the worker is a single `arq` process.

## Known trade-off — maintenance-mode

arq (`samuelcolvin/arq`) is in **maintenance-only mode** upstream. The original maintainer moved to Pydantic; PRs are accepted but there is no active feature development. We accept this knowingly.

**Why arq, not Celery:** Celery is sync-first; its async story has historically been bolted-on and its worker model is heavier (separate beat, flower, result backend concerns). For a project whose entire backend is async, the async-native fit matters more than the maintenance signal. arq's surface is small enough that maintenance-mode is a manageable risk.

## Rejected alternatives

- **Celery:** Industry default, huge ecosystem, but sync-first design fights our async backend, and its operational footprint (broker + result backend + beat + flower) is heavier than a solo-dev project needs.
- **RQ (Redis Queue):** Simpler than Celery but also sync-first; bolting onto an async FastAPI is awkward.
- **taskiq:** Async-native and actively maintained — the strongest alternative. Not chosen in M0 only because arq's smaller surface and closer alignment with the async-SQLAlchemy pattern is enough to start; taskiq is the documented fallback (see revisit trigger).
- **dramatiq:** Stable and reliable, but sync-first with the same async-fit problem as Celery.

## Consequences

- Async-native fit with FastAPI + async SQLAlchemy.
- Betting on a maintenance-mode library; mitigated by a documented revisit trigger and a clear fallback (taskiq).
- Coupled to the Upstash+arq compatibility risk (ADR 0004) — the M3 spike gates both.

## Revisit trigger

- If the M3 Upstash+arq spike reveals an incompatibility that upstream won't fix (because maintenance-mode).
- If a security or Python-version compatibility issue goes un-patched upstream.
- If the worker's job patterns outgrow arq's feature surface (complex workflows, retries-with-backoff policies, or scheduling arq doesn't support).

**Fallback if revisited:** taskiq (async-native, actively maintained).

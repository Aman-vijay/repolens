# ADR 0004: Managed data infra: Neon and Upstash

**Status:** Accepted
**Date:** 2026-07-02

## Context

RepoLens needs Postgres with the pgvector extension (primary store + vector embeddings, M1/M4) and Redis (ARQ job queue transport, M3). We want zero local-infra maintenance and dev/prod parity on the data axis. Both stores should be managed services from day one.

## Decision

- **Postgres + pgvector → Neon.** Managed, serverless, supports DB branching, pgvector pre-enabled. Dev and prod use different Neon projects over the same Postgres wire protocol.
- **Redis → Upstash.** Managed, per-request pricing (fits a queue that's often idle), exposes both a REST API and a Redis-protocol-compatible endpoint. Dev and prod use different Upstash databases over `rediss://`.

Both are consumed via standard connection strings (`DATABASE_URL`, `REDIS_URL`) documented in `.env.example` and ADR 0006.

## Rejected alternatives

- **Self-hosted Postgres+pgvector in Docker (local) + managed in prod:** Rejected — reintroduces the dual-config drift this milestone chose to avoid, and the old dev/prod parity concern (local pgvector version vs prod) returns.
- **Render managed Postgres + manual `CREATE EXTENSION vector`:** Workable, but loses Neon's branching (useful for per-feature dev DBs later) and couples the DB region to the worker host. We're using Neon specifically for pgvector-as-a-first-class-managed-feature and branching.
- **Render managed Redis instead of Upstash:** Cheaper and co-located with the worker, but no serverless scaling and ties queue region to the worker host. Upstash's per-request pricing suits a queue that's bursty-then-idle.
- **Upstash REST-only usage:** Rejected for the queue — ARQ uses `redis-py` which speaks the Redis protocol, not REST. We MUST use Upstash's Redis-protocol endpoint. See flagged risk below.

## Flagged risk — Upstash + arq compatibility

Upstash provides a Redis-protocol-compatible endpoint (not REST-only), so arq (via `redis-py`) is *expected* to work. But Upstash restricts certain Redis commands and behaves differently on clustering/persistence vs. vanilla Redis. arq depends on specific Redis patterns (queue lists, result storage, job polling). **Compatibility is expected but NOT verified.**

**Milestone 3 must open with a connection spike** — enqueue one job, dequeue it, read its result — before any producer/consumer logic is built. If the spike fails, fallbacks are: (a) self-managed Redis on Render (reintroducing a container we otherwise avoided), or (b) a queue library swap (see ADR 0005). The spike is the gate; do not build M3 features on an unverified assumption.

## Consequences

- Zero local-infra maintenance; dev requires connectivity to Neon/Upstash.
- Infra-axis dev/prod parity is strong (same managed pgvector/Redis in both).
- One unverified integration (Upstash + arq) gated behind an M3 spike.
- Neon branching available as a future capability (not adopted in M0 — single shared dev project; see ADR 0006).

## Revisit trigger

- If the M3 Upstash+arq spike fails and we fall back to self-managed Redis.
- If Neon/Upstash pricing or reliability degrades.
- If we need per-feature dev DBs (adopt Neon branching — see ADR 0006 adoption trigger).

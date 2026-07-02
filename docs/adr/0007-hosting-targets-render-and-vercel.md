# ADR 0007: Hosting targets: Render and Vercel

**Status:** Accepted
**Date:** 2026-07-02

## Context

RepoLens has three deployable surfaces: a Next.js frontend, a FastAPI backend, and ARQ workers. We need hosting that supports async Python + persistent worker processes + a Next.js frontend, with minimal ops burden. M0 establishes the deployment targets so later milestones build toward them.

A key constraint: the project's objective is to demonstrate backend architecture, asynchronous processing, and clean system design — not infrastructure management. The queue architecture (ARQ, ADR 0005) must be preserved; this rules out serverless-only hosts (ARQ needs a long-running process, not serverless invocations).

## Decision

- **Frontend → Vercel.** Next.js's native host; zero-config builds, preview deployments per PR, edge functions if needed later.
- **Backend (API + Worker) → Render.** Render supports long-running Web Services (FastAPI) and Background Workers (ARQ consumer) as separate persistent processes. Both `apps/api` and `workers/` deploy as Render services. Paid tier required — the free tier spins down on inactivity, which kills an ARQ consumer.

## Why Render over Docker on a VPS

Docker on a VPS was rejected because the project's objective is to demonstrate backend architecture and AI systems, not infrastructure management. Using a managed platform reduces operational overhead while preserving support for long-running worker processes. The cost (Render's paid tier) is the price of not hand-wiring TLS, restarts, logs, and patching — the same trade-off M0 made by going managed for Neon and Upstash.

## Render's free tier is insufficient — paid tier required

Unlike Neon, Upstash, Vercel, Clerk, and R2 — all of which have meaningful free tiers covering early-stage dev — **Render's free tier is insufficient for this project** because background workers spin down on inactivity, breaking an ARQ consumer that must stay alive to dequeue jobs. The paid tier is a recurring cost decision made consciously, not folded into "managed services are free."

## Rejected alternatives

- **Railway (the original M0 candidate):** Functionally equivalent to Render for our needs — both support persistent web services and background workers with env management and GitHub deploys. Render chosen per project direction; the two are near-substitutes and the decision is low-stakes and reversible.
- **Fly.io:** More config ceremony for similar cost; better for multi-region edge deploys we don't need yet.
- **Render free tier:** Insufficient — background workers spin down on inactivity, breaking the ARQ consumer.
- **VPS + Docker Compose:** Cheapest, but reintroduces the ops burden (patching, restarts, logs, TLS) that M0 specifically chose to avoid. See "Why Render over Docker on a VPS" above.
- **Vercel for the backend too (serverless functions):** Rejected — ARQ workers need a long-running process, not serverless invocations. This would force abandoning ARQ for a serverless-native queue (Upstash QStash), cascading into ADR 0005. Vercel is frontend-only here.

## Consequences

- Frontend/backend split across two hosts (Vercel + Render) — slightly more to manage, but each is best-in-class for its surface.
- Render paid tier is a real recurring line-item cost; acknowledged and reversible to a VPS if cost becomes material.
- Worker and API co-located on Render simplifies internal networking and shared env.
- Cross-host calls (Vercel → Render) require explicit CORS configuration (addressed in M1).
- Preview deployments: Vercel gives per-PR frontend previews; Render gives per-environment deploys.

## Revisit trigger

- If Render cost becomes material relative to usage → re-evaluate VPS + Docker Compose (accepting the ops burden trade-off).
- If the worker needs multi-region distribution → re-evaluate Fly.io.
- If Vercel pricing/limits become a constraint for the frontend → re-evaluate self-hosted Next.js.

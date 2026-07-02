# ADR 0006: Secrets and environment management

**Status:** Accepted
**Date:** 2026-07-02

## Context

RepoLens integrates seven external services (Vercel, Render, Neon, Upstash, Clerk, Cloudflare R2, OpenAI), each with credentials. Secrets must be supplied correctly per environment (local dev, Render backend, Vercel frontend) without leaking backend secrets to the browser bundle or spraying credentials where they aren't needed.

## Decision

### Core principle — scope secrets to the surface that needs them

The frontend (Vercel) never holds DB, queue, AI, or storage credentials. It holds only `NEXT_PUBLIC_*` vars (publishable Clerk key, API URL). Everything else lives on Render (backend + worker). This is the actual security story, not a flat variable dump.

### `.env.example` as the contract

`.env.example` lists every var across all seven services, each annotated with: who consumes it, which milestone uses it, and whether it's browser-safe. R2 vars are listed now (consumed in M2) so the secrets contract is complete and honest upfront — M2 doesn't silently expand the secret surface.

### Supply mechanism per environment

| Secret | Local dev | Render (API + Worker) | Vercel (Web) |
|--------|-----------|------------------------|--------------|
| `DATABASE_URL` | `.env` (dev Neon) | Render dashboard vars (prod Neon) | not set |
| `REDIS_URL` | `.env` (dev Upstash) | Render vars (prod Upstash) | not set |
| `CLERK_SECRET_KEY` | `.env` | Render vars | not set |
| `CLERK_WEBHOOK_SECRET` | `.env` | Render vars | not set |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env` | not set | Vercel env (Production + Preview) |
| `NEXT_PUBLIC_API_URL` | `.env` (localhost:8000) | not set | Vercel env (Render API URL) |
| `OPENAI_API_KEY` | `.env` | Render vars | not set |
| `R2_*` (5 vars, M2) | `.env` | Render vars | not set |

- **Local:** `.env` (gitignored), hand-filled from `.env.example`. Each dev uses their own dev Neon project + dev Upstash DB.
- **Render:** Variables set via Render dashboard/CLI, injected as real env vars at runtime. No `.env` file on the server.
- **Vercel:** Project Settings → Environment Variables, scoped per environment (Production / Preview / Development). `NEXT_PUBLIC_*` is inlined into the client bundle; everything else is server-only and never ships to the browser.

### Neon dev DB — single shared project

A single shared dev Neon project is used (not per-dev branching). Solo builder means branching's contention-avoidance benefit doesn't apply. Branching is adopted only if the team grows beyond solo or parallel feature branches emerge (recorded as the adoption trigger, not used now).

### Boundary rule

A new secret requires an ADR amendment if it crosses the boundary (e.g., a backend var added to the frontend). Adding a var within an existing surface (e.g., a new R2 var) just extends `.env.example` with annotation.

## Rejected alternatives

- **Per-app `.env.example` files:** Premature — only ~6 vars total right now, and the single-file contract is easier to audit. Split when it actually hurts.
- **Shared dev Neon project with per-dev branching now:** Rejected — no contention to avoid as a solo dev; adopting it just for the resume story is cargo-culting. Documented the capability and adoption trigger instead.
- **Frontend holds all secrets (convenience):** Rejected outright — browser bundles are public; backend credentials must never reach them.

## Consequences

- Clear security boundary: frontend can only ever see `NEXT_PUBLIC_*`.
- One `.env.example` to audit; per-environment supply is documented.
- Neon branching capability recorded but not used — honest about why.
- New secrets that cross surfaces trigger an ADR amendment (not a silent commit).

## Revisit trigger

- If the team grows beyond solo → adopt Neon per-dev branching.
- If a second frontend or backend surface appears → reconsider per-surface `.env` files.
- If secret count grows enough that a flat `.env.example` becomes hard to audit.

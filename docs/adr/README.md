# Architecture Decision Records

An ADR records *why* a decision was made — not just what was decided. RepoLens uses ADRs for interview-prep value as much as for future maintainers: every non-trivial choice gets its trade-offs written down while the reasoning is fresh.

## Conventions

- **Numbering:** zero-padded, monotonic (`0001`, `0002`, ...). Never reuse a number.
- **Filename:** `NNNN-kebab-case-title.md`
- **Status:** `Proposed` → `Accepted` → (optionally) `Superseded` or `Deprecated`. Status lives in a header line.
- **Supersession:** when a later ADR overturns an earlier one, mark the earlier ADR `Superseded by NNNN` and link forward.

## Template

    # ADR NNNN: Title

    **Status:** Accepted
    **Date:** YYYY-MM-DD

    ## Context
    (Why this decision is needed — forces, constraints, problem statement)

    ## Decision
    (What we decided, stated concretely)

    ## Rejected alternatives
    (Each real alternative considered, and the specific reason it was rejected)

    ## Consequences
    (What follows from this decision — positive, negative, neutral)

    ## Revisit trigger
    (Conditions under which we'd reopen this decision)

## Index

- 0001 — Monorepo layout, package topology, and dev/prod parity strategy
- 0002 — Python tooling: uv workspace
- 0003 — JS tooling: pnpm workspaces (no Turborepo)
- 0004 — Managed data infra: Neon and Upstash
- 0005 — Queue library: arq (maintenance-mode accepted)
- 0006 — Secrets and environment management
- 0007 — Hosting targets: Render and Vercel
- 0008 — Frontend framework: Next.js 15 App Router
- 0009 — Auth architecture: Clerk with lazy upsert fallback
- 0010 — Client data fetching: TanStack Query
- 0011 — Dev ergonomics: Makefile and CI build-smoke
- 0012 — Repository data model: JSONB metadata on repositories
- 0013 — Clone service: shallow clone with BackgroundTasks
- 0014 — GitHub OAuth scope and repository listing
- 0015 — Superadmin via is_superuser env-var seed
- 0016 — GitHub-only auth with custom sign-in
- 0017 — ARQ durable queue replacing BackgroundTasks
- 0018 — Progress tracking via DB column
- 0019 — Worker as peer process preserving topology
- 0020 — Semantic code search via chunking, embeddings, and pgvector

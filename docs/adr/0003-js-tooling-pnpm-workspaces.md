# ADR 0003: JS tooling: pnpm workspaces (no Turborepo)

**Status:** Accepted
**Date:** 2026-07-02

## Context

The TypeScript side of the monorepo currently has one app (`apps/web`) and a reserved `packages/` slot for future shared TS contracts (M1). We need a workspace manager that lets `apps/web` depend on local `packages/*` without publishing, with a lockfile for reproducibility.

## Decision

Use **pnpm workspaces** via `pnpm-workspace.yaml`:

    packages:
      - "apps/web"
      - "packages/*"

No Turborepo, no Nx. `pnpm install` at root resolves the workspace; `packages/*` is a glob so future TS packages are picked up automatically. (The Python `packages/db` subdir has no `package.json`, so pnpm silently skips it — the polyglot coexistence is clean.)

## Rejected alternatives

- **Turborepo:** Adds local + remote caching and task pipelines. Rejected because the cache pays off when many TS packages build in parallel; we have one TS app and no build-graph orchestration needs yet. Bolt it on in M8 if the build graph actually demands it.
- **Nx:** Heavier, more opinionated, with a steeper learning curve and its own project-graph model. Overkill for one app.
- **npm workspaces:** Workable, but pnpm's strict node_modules layout (symlinked, no phantom deps) is materially better for a monorepo and avoids whole classes of dependency-resolution bugs.
- **Yarn workspaces:** Fine, but pnpm is faster and its strictness prevents the "phantom dependency" problem Yarn allows.

## Consequences

- Minimal config (one YAML file); zero build orchestration overhead.
- No cached builds across apps — fine for one TS app; becomes a cost if `packages/` grows into several shared TS libraries.
- Strict node_modules prevents phantom dependencies — a real correctness benefit, not just performance.

## Revisit trigger

- When a second TS app or multiple shared TS packages exist and build caching would pay off (likely M8 at the earliest).

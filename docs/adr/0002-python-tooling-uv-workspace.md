# ADR 0002: Python tooling: uv workspace

**Status:** Accepted
**Date:** 2026-07-02

## Context

RepoLens has three Python packages (`apps/api`, `workers/`, `packages/db`) that must depend on each other locally during development without publishing to a package index. We need a Python project manager that handles virtualenvs, lockfiles, and local workspace dependencies in one tool.

## Decision

Use **uv** with a root `pyproject.toml` declaring a workspace:

    [tool.uv.workspace]
    members = ["apps/api", "workers", "packages/db"]

`apps/api` and `workers/` declare `repolens-db` as a dependency and mark it `{ workspace = true }` in `[tool.uv.sources]`, so the dependency resolves from the local path, not PyPI. `uv sync` at root installs the workspace graph; syncing a member pulls its dependencies into the shared `.venv`.

`packages/db` uses a **src layout** (`src/repolens_db/`) with an explicit `[build-system]` (setuptools) so the distribution name `repolens-db` maps correctly to the import name `repolens_db`.

## Rejected alternatives

- **Poetry:** Mature and widely known, but noticeably slower installs, heavier, and its lockfile story is being eclipsed by uv. No workspace-as-path-dependency story as clean as uv's.
- **pip + venv (no lockfile):** Rejected — no lockfile means unreproducible environments, unacceptable for a system treated as production.
- **pip-tools (pip-compile):** Workable but bolted onto raw pip; no first-class workspace concept, so cross-package local deps become manual path installs.
- **Hatch:** Capable, but smaller community and less momentum than uv in 2026.

## Consequences

- Fast installs, single binary, lockfile out of the box.
- Betting on a newer tool with less Stack Overflow coverage; mitigated by excellent official docs.
- Reversible — migration to Poetry/pip-tools is mechanical if needed, but more annoying the more code we write.

## Revisit trigger

- If uv introduces breaking changes that disrupt the workspace model.
- If a dependency is fundamentally incompatible with uv's resolver.

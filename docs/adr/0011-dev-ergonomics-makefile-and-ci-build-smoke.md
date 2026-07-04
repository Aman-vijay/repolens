# ADR 0011: Dev ergonomics and CI: Makefile + GitHub Actions build-smoke

**Status:** Accepted  
**Date:** 2026-07-03

## Context

RepoLens is a polyglot monorepo with a Python/FastAPI backend and a TypeScript/Next.js frontend. Running dev servers, builds, migrations, and linters requires switching between `uv`, `pnpm`, and different working directories. We want a single, discoverable command surface for daily development and a CI gate that catches compile/type errors before they reach `main`.

## Decision

1. **Makefile as the unified command surface.** From the repo root, run:
   - `make api` — start the FastAPI dev server.
   - `make web` — start the Next.js dev server.
   - `make build` — production build-smoke (Next.js + FastAPI import check).
   - `make db-migrate` — run Alembic migrations.
   - `make db-revision msg="..."` — create a new Alembic revision.
   - `make sync`, `make clean`, `make test`, `make lint`, `make typecheck` — dependency install, cleanup, test, lint, and type-check entry points.

2. **GitHub Actions CI workflow** (`.github/workflows/ci.yml`) that installs dependencies with `make sync` and runs `make build` on every push and pull request to `main`.

## Why a Makefile

- Ubiquitous, language-agnostic, and works in local shells and CI without extra tools.
- Removes the need to remember which directory each command belongs in.
- Serves as living documentation of the project's common tasks.

## Why `make build` as the CI gate

- `next build` compiles TypeScript, bundles client code, and prerenders static routes — surfacing type errors, import errors, and runtime-axis parity bugs early.
- The FastAPI import check (`python -c "import app.main"`) verifies that the backend package imports cleanly.
- To keep the import check honest without requiring real secrets in CI, settings and the database engine are initialized lazily (validated only at runtime, not at module import time).
- This is the minimal CI gate that gives high confidence for a project without test suites yet.

## Rejected alternatives

- **npm scripts only**: Cannot easily orchestrate cross-language commands from the root without wrapper packages.
- **Custom shell scripts**: More files to maintain; Make is standard and self-documenting via `make help`.
- **No CI**: Would let build failures land on `main`, breaking the dev/prod parity goal from ADR 0001.
- **A task runner like Just or Task**: Good tools, but Make is already available everywhere and sufficient for our needs.

## Consequences

- All team members and CI use the same command surface.
- The build-smoke job runs on every PR; required status check should be enabled in GitHub branch protection.
- `make build` currently focuses on compilation; lint and test targets will be hardened as M1+ adds ruff/pytest/pyright configs.

## Revisit trigger

- If the project adds many conditional tasks → evaluate `just` or Python `invoke`.
- Once test and lint configs exist → expand CI to run `make lint` and `make test`.
- If CI becomes slow → add caching layers (uv cache, pnpm cache, Next.js remote cache).

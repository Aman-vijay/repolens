# Changelog

All notable changes to RepoLens are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/), adhering to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Milestone 0: Architecture foundation
- Monorepo skeleton: `apps/web`, `apps/api`, `workers/`, `packages/db`
- Workspace manifests: `pnpm-workspace.yaml` (TS), root `pyproject.toml` (uv workspace)
- Per-package manifests with metadata only (no runtime dependencies yet)
- `packages/db` peer-kernel package established (src layout: `src/repolens_db/__init__.py`); SQLAlchemy models land in M1
- `.env.example` secrets contract covering all 7 external services, annotated per consumer
- `Makefile` as the unified command surface across uv (Python) and pnpm (Node): `make sync`, `make clean`, `make help`
- `docs/architecture.md` with dev/prod topology (Mermaid)
- 7 ADRs recording foundation decisions (monorepo/parity, uv, pnpm, managed infra, arq, secrets, hosting)

### Changed — Milestone 0
- Hosting target swapped from Railway to Render (ADR 0007) — preserves the long-running ARQ worker model without the ops burden of a self-managed VPS; all cross-references updated.

### Carried into Milestone 1 (required, from M0 design review)
- Neon connection pooling (serverless Postgres connection limits require explicit pool config)
- CI build-smoke validation (`next build` + `uvicorn` import smoke to surface runtime-axis parity bugs early)
- CORS configuration (cross-host calls: Vercel frontend → Render backend)
- Basic observability / structured logging (established from the first route, not bolted on later)

# Changelog

All notable changes to RepoLens are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/), adhering to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added — Milestone 4: Embedding + semantic code search
- `CodeChunk` model in `packages/db` with pgvector embeddings, per-file chunk metadata, and repository ownership.
- Alembic migration `85bb31a7cdaa_add_code_chunks_table` creating `code_chunks`, repository index, and HNSW cosine index.
- Tree-sitter based chunking service in `workers/chunk_service.py` with fixed-line fallback for unsupported grammars.
- OpenAI embedding service in `workers/embed_service.py` using `text-embedding-3-small` batching.
- ARQ worker pipeline now runs clone → metadata → chunk → embed → store before marking the repository ready.
- Semantic search API: `POST /api/projects/{id}/search` performing query embedding + pgvector cosine similarity search scoped to the project's repository.
- Project detail dashboard now includes semantic code search results with file path, line range, score, and snippet preview.
- ADR 0020 documenting the semantic code search pipeline.

### Added — Milestone 3: Worker (ARQ queue)
- ARQ worker package (`workers/worker.py`) with `clone_repository` job function, durable Redis queue, structlog logging, and `.env` loading.
- `progress` integer column on `Repository` model (0–100) — worker writes at each phase (10 → 40 → 80 → 100).
- Alembic migration `885ef361c0e5_add_progress_to_repositories` applied to Neon.
- `app/services/queue.py` — lazy ARQ connection pool + `enqueue_clone(repository_id)`.
- API `POST /api/projects/{id}/repository` now enqueues to ARQ instead of `BackgroundTasks`.
- `make worker` Makefile target to start the ARQ worker process.
- Frontend `Progress` bar uses actual `progress` value from the API (not hardcoded).
- ADRs 0017–0019: ARQ durable queue, progress tracking via DB, worker as peer process.

### Added — Milestone 2: Repository upload
- `Repository` model in `packages/db`: 1:1 with `Project`, JSONB `file_tree` + `languages` columns, status enum (pending/cloning/ready/failed).
- `is_superuser` boolean column on `User` model, seeded via `SUPERADMIN_CLERK_USER_ID` env var.
- Alembic migration `311d91274456_add_is_superuser_and_repositories` applied to Neon.
- Clone service (`app/services/clone.py`): shallow `git clone --depth 1`, metadata extraction (file tree to depth 4, language breakdown by extension, file count, total size), 30s timeout.
- Repository API: `POST /api/projects/{id}/repository` (202 + background clone), `GET /api/projects/{id}/repository`, `GET /api/projects/{id}` (project detail with embedded repo).
- `GET /api/github/repos` proxy: retrieves GitHub OAuth token from Clerk Backend API, lists user's public repos.
- Admin API: `GET /api/admin/stats`, `GET /api/admin/users`, `GET /api/admin/projects` — all protected by `get_current_superuser` dependency.
- GitHub-only auth: custom sign-in/sign-up pages with `oauth_github` strategy, SSO callback page.
- Project detail page (`/dashboard/[projectId]`): file tree viewer (collapsible), language breakdown bar, repo status badge, GitHub repo picker.
- Admin dashboard (`/admin`): stats cards, user list, project list.
- ADRs 0012–0016: repository data model, clone service, GitHub OAuth scope, superadmin seed, GitHub-only auth.

### Added — Milestone 1: Auth + Project lifecycle
- PostgreSQL data layer in `packages/db`: async SQLAlchemy 2.0 engine, declarative base, `User` and `Project` models.
- Alembic async setup in `apps/api` with first migration (`880253444708_initial_users_and_projects`) applied to Neon.
- FastAPI app (`apps/api`) with health check, CORS for cross-host calls, structlog request logging, and Clerk SDK auth.
- Clerk webhook handler (`apps/api/app/routes/webhooks.py`) for verified `user.created` events.
- `get_current_user` dependency with lazy idempotent upsert (`INSERT ... ON CONFLICT DO NOTHING`) as webhook fallback.
- Project CRUD routes (`/api/projects`) protected by Clerk JWT, linked to the authenticated user.
- Next.js 15 frontend (`apps/web`) with App Router, React 19, Tailwind dark theme, and Clerk auth UI.
- Route protection via Clerk middleware (`/dashboard` requires sign-in).
- TanStack Query client data layer (`lib/queries.ts`) plus typed REST client (`lib/api.ts`) using Clerk `getToken()`.
- Dashboard UI: `CreateProjectForm`, `ProjectList`, and `Navbar` components.
- `Makefile` real targets: `make api`, `make web`, `make build`, `make db-migrate`, `make db-revision`.
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) running `make build` on every push/PR to `main`.
- ADRs 0008–0011: Next.js 15 frontend, Clerk auth architecture, TanStack Query, Makefile + CI build-smoke.

### Resolved — Milestone 0 carried-over items
- Neon asyncpg connection handling: strip libpq query params and pass `ssl=require` via `connect_args`.
- CORS configured for Vercel frontend → Render backend cross-host calls.
- Structured request logging established from the first route via structlog.
- CI build-smoke validation established (`next build` + FastAPI import check).
- Lazy initialization for settings and the DB engine so the backend imports cleanly during CI build-smoke without real secrets.

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

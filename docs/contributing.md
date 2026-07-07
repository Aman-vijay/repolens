# Contributing to RepoLens

Thank you for your interest in contributing to RepoLens!

## Development Setup

### Prerequisites

- Python 3.11+
- Node.js 20+
- pnpm 8+
- uv (Python package manager)
- Docker (for local Postgres/Redis if not using managed services)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/repolens.git
cd repolens

# Install all dependencies
make sync

# Run the development servers
make api   # Terminal 1: FastAPI on localhost:8000
make web   # Terminal 2: Next.js on localhost:3000
make worker # Terminal 3: ARQ background worker
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - Neon PostgreSQL connection string
- `REDIS_URL` - Upstash Redis connection string
- `CLERK_SECRET_KEY` - Clerk backend API key
- `CLERK_WEBHOOK_SECRET` - Clerk webhook signing secret
- `OPENAI_API_KEY` - OpenAI API key
- `SUPERADMIN_CLERK_USER_ID` - Clerk user ID for superuser access

## Project Structure

```
repolens/
├── apps/
│   ├── api/          # FastAPI backend
│   │   ├── app/
│   │   │   ├── routes/    # API endpoints
│   │   │   ├── services/  # Business logic
│   │   │   ├── schemas/   # Pydantic models
│   │   │   ├── deps.py    # Auth dependencies
│   │   │   └── main.py    # FastAPI app
│   │   ├── tests/         # Integration & unit tests
│   │   └── alembic/       # Database migrations
│   └── web/          # Next.js frontend
│       ├── components/    # React components
│       ├── lib/           # Utilities, API client, queries
│       ├── app/           # Next.js App Router pages
│       └── tests/         # Vitest + Playwright tests
├── packages/
│   ├── db/           # SQLAlchemy models (shared)
│   └── prompts/      # Jinja2 prompt templates
├── workers/          # ARQ background jobs
├── docs/             # Architecture decision records
└── evaluation/       # Prompt evaluation fixtures
```

## Making Changes

### Adding a New API Route

1. Create or update the schema in `apps/api/app/schemas/`
2. Add the endpoint in `apps/api/app/routes/`
3. Add service logic in `apps/api/app/services/`
4. Add tests in `apps/api/tests/`

### Adding a New Prompt

1. Create the prompt template in `packages/prompts/src/prompts/`
2. Use the system/user prompt separation
3. Test with `uv run python evaluation/evaluate_prompts.py --mode smoke`
4. Update the AI guidelines if behavior changes significantly

### Adding a New Database Model

1. Add the model to `packages/db/src/repolens_db/models.py`
2. Create a migration: `make db-revision msg="add new model"`
3. Test the migration: `make db-migrate`

## Testing

```bash
# Run backend tests
cd apps/api && uv run pytest

# Run frontend tests
cd apps/web && pnpm test

# Run E2E tests
cd apps/web && pnpm playwright test

# Run all tests
make test
```

## Code Quality

```bash
# Run linters
make lint

# Run type checkers
make typecheck

# Format code
cd apps/api && uv run ruff format .
cd apps/web && pnpm lint --fix
```

## Submitting Changes

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes and add tests
3. Ensure all tests pass: `make test`
4. Run linters and type checks: `make lint typecheck`
5. Commit with a clear message following conventional commits
6. Push and create a pull request

## Getting Help

- Check the [Troubleshooting Guide](troubleshooting.md) for common issues
- Read existing ADRs in `docs/adr/` for architectural context
- Open an issue for bugs or feature requests

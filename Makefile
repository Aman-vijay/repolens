.PHONY: help sync clean api web dev test lint typecheck build db-migrate db-revision

help: ## Show available targets
	@echo "RepoLens targets:"
	@echo "  sync        Install all dependencies (uv workspace + pnpm workspace)"
	@echo "  clean       Remove .venv, node_modules, and caches"
	@echo "  api         Start FastAPI dev server (uses apps/api/.env)"
	@echo "  web         Start Next.js dev server (uses apps/web/.env)"
	@echo "  dev         Notes on running api + web together"
	@echo "  test        Run test suites"
	@echo "  lint        Run linters"
	@echo "  typecheck   Run type checkers (mypy/pyright + tsc)"
	@echo "  build       Production build-smoke (Next.js + FastAPI import check)"
	@echo "  db-migrate  Run Alembic migrations"
	@echo "  db-revision Create a new Alembic revision (msg=<name>)"

sync: ## Install all dependencies (all workspace packages)
	uv sync --all-packages
	pnpm install

clean: ## Remove build artifacts and caches
	rm -rf .venv node_modules .next .pytest_cache .mypy_cache .ruff_cache

api: ## Start FastAPI dev server
	cd apps/api && uv run uvicorn app.main:app --reload

web: ## Start Next.js dev server
	cd apps/web && pnpm dev

dev: ## Explain how to run both dev servers
	@echo "Run these in two separate terminals:"
	@echo "  make api"
	@echo "  make web"

test: ## Run test suites
	cd apps/api && uv run pytest

lint: ## Run linters
	cd apps/api && uv run ruff check .
	cd apps/web && pnpm lint

typecheck: ## Run type checkers
	cd apps/api && uv run pyright
	cd apps/web && pnpm typecheck

build: ## Production build-smoke
	cd apps/web && pnpm build
	cd apps/api && uv run python -c "import app.main"

db-migrate: ## Run Alembic migrations
	cd apps/api && uv run alembic upgrade head

db-revision: ## Create a new Alembic revision: make db-revision msg="add users"
	cd apps/api && uv run alembic revision --autogenerate -m "$(msg)"

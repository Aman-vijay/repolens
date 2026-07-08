.PHONY: help sync clean api web worker dev test lint typecheck build db-migrate db-revision
.PHONY: docker-up docker-down docker-logs docker-build docker-shell docker-migrate

help: ## Show available targets
	@echo "RepoLens targets:"
	@echo "  sync        Install all dependencies (uv workspace + pnpm workspace)"
	@echo "  clean       Remove .venv, node_modules, and caches"
	@echo "  api         Start FastAPI dev server"
	@echo "  web         Start Next.js dev server"
	@echo "  worker      Start ARQ background worker"
	@echo "  dev         Notes on running api + web together"
	@echo "  test        Run test suites"
	@echo "  lint        Run linters"
	@echo "  typecheck   Run type checkers (mypy/pyright + tsc)"
	@echo "  build       Production build-smoke (Next.js + FastAPI import check)"
	@echo "  db-migrate  Run Alembic migrations"
	@echo "  db-revision Create a new Alembic revision (msg=<name>)"
	@echo "  docker-up       Start all services with Docker Compose"
	@echo "  docker-down     Stop all Docker services"
	@echo "  docker-logs     View Docker logs (follow=false)"
	@echo "  docker-build     Rebuild Docker images"
	@echo "  docker-shell     Open shell in API container"
	@echo "  docker-migrate   Run migrations in Docker"

sync: ## Install all dependencies (all workspace packages)
	uv sync --all-packages
	pnpm install

clean: ## Remove build artifacts and caches
	rm -rf .venv node_modules .next .pytest_cache .mypy_cache .ruff_cache

api: ## Start FastAPI dev server
	cd apps/api && uv run uvicorn app.main:app --reload

web: ## Start Next.js dev server
	cd apps/web && pnpm dev

worker: ## Start ARQ worker
	uv run arq workers.worker.WorkerSettings

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

docker-up: ## Start all services with Docker Compose
	docker compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 10
	@echo "Services started:"
	@echo "  API:    http://localhost:8000"
	@echo "  Web:    http://localhost:3000"
	@echo "  Docs:   http://localhost:8000/docs"

docker-down: ## Stop all Docker services
	docker compose down

docker-logs: ## View Docker logs
	docker compose logs -f

docker-build: ## Rebuild Docker images (no cache)
	docker compose build --no-cache

docker-shell: ## Open shell in API container
	docker compose exec api /bin/sh

docker-migrate: ## Run migrations in Docker
	docker compose exec api python -m alembic upgrade head

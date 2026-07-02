.PHONY: help sync clean dev test lint

help: ## Show available targets
	@echo "RepoLens targets:"
	@echo "  sync    Install all dependencies (uv workspace + pnpm workspace)"
	@echo "  clean   Remove .venv, node_modules, and caches"
	@echo "  dev     Start dev servers (available from M1)"
	@echo "  test    Run test suites (available from M1)"
	@echo "  lint    Run linters (available from M1)"

sync: ## Install all dependencies (all workspace packages)
	uv sync --all-packages
	pnpm install

clean: ## Remove build artifacts and caches
	rm -rf .venv node_modules .next .pytest_cache .mypy_cache .ruff_cache

dev: ## Start dev servers (M1 onward)
	@echo "==> dev servers arrive in Milestone 1"

test: ## Run test suites (M1 onward)
	@echo "==> tests arrive in Milestone 1"

lint: ## Run linters (M1 onward)
	@echo "==> linters arrive in Milestone 1"

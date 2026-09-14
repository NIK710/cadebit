.PHONY: lint format format-check test eval

lint:
	cd apps/web && npm run lint
	services/ai/.venv/bin/ruff check services/ai

format:
	cd apps/web && npm run format
	services/ai/.venv/bin/ruff check --fix services/ai
	services/ai/.venv/bin/ruff format services/ai

format-check:
	cd apps/web && npm run format:check
	services/ai/.venv/bin/ruff format --check services/ai

test:
	cd apps/web && npm test
	cd services/ai && .venv/bin/pytest

eval:
	cd services/ai && .venv/bin/python -m evaluation --suite retrieval --fail-on-regression

SHELL := /bin/sh

UV_CACHE_DIR ?= .uv-cache
CONFIG ?= ./opensquilla.toml
RUNTIME_HOME ?= .opensquilla
TEST_HOME ?= .opensquilla/pytest
HOST ?= 127.0.0.1
PORT ?= 18791
PYTEST_ARGS ?=
TEST_PATH ?= tests

SERVICE_ENV := UV_CACHE_DIR=$(UV_CACHE_DIR) OPENSQUILLA_STATE_DIR=$(RUNTIME_HOME) OPENSQUILLA_GATEWAY_STATE_DIR=$(RUNTIME_HOME)/state OPENSQUILLA_GATEWAY_WORKSPACE_DIR=$(RUNTIME_HOME)/workspace OPENSQUILLA_LOG_DIR=$(RUNTIME_HOME)/logs
TEST_ENV := UV_CACHE_DIR=$(UV_CACHE_DIR) OPENSQUILLA_STATE_DIR=$(TEST_HOME) OPENSQUILLA_GATEWAY_STATE_DIR=$(TEST_HOME)/state OPENSQUILLA_GATEWAY_WORKSPACE_DIR=$(TEST_HOME)/workspace OPENSQUILLA_LOG_DIR=$(TEST_HOME)/logs
UV_RUN := $(SERVICE_ENV) uv run
TEST_UV_RUN := $(TEST_ENV) uv run
OPENSQUILLA := $(UV_RUN) opensquilla
PYTEST := $(TEST_UV_RUN) pytest

.DEFAULT_GOAL := help

.PHONY: help sync cli doctor run start stop restart status logs test test-fast lint typecheck config-show config-provider clean-cache clean-runtime

help: ## Show available maintenance targets.
	@awk 'BEGIN {FS = ":.*##"; printf "OpenSquilla dev targets\n\n"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

sync: ## Install/update the local development environment.
	UV_CACHE_DIR=$(UV_CACHE_DIR) uv sync --extra recommended --extra dev

cli: ## Verify the local checkout CLI starts.
	$(OPENSQUILLA) --help

doctor: ## Check readiness using the project config.
	$(OPENSQUILLA) doctor --config $(CONFIG)

run: ## Run the gateway in the foreground.
	$(OPENSQUILLA) gateway run --config $(CONFIG) --listen $(HOST) --port $(PORT)

start: ## Start the managed gateway in the background.
	$(OPENSQUILLA) gateway start --config $(CONFIG) --listen $(HOST) --port $(PORT) --json

stop: ## Stop the managed gateway.
	$(OPENSQUILLA) gateway stop --config $(CONFIG)

restart: ## Restart the managed gateway.
	$(OPENSQUILLA) gateway restart --config $(CONFIG) --listen $(HOST) --port $(PORT)

status: ## Inspect the managed gateway.
	$(OPENSQUILLA) gateway status --config $(CONFIG)

logs: ## Show recent gateway log lines when available.
	@log="$(RUNTIME_HOME)/logs/debug.log"; \
	if [ -f "$$log" ]; then tail -n 120 "$$log"; else echo "No gateway log found at $$log"; fi

test: ## Run the test suite, optionally with PYTEST_ARGS.
	$(PYTEST) $(TEST_PATH) $(PYTEST_ARGS)

test-fast: ## Run local tests while excluding live/provider/browser markers.
	$(PYTEST) $(TEST_PATH) -m "not llm and not live_channel and not webui_browser" $(PYTEST_ARGS)

lint: ## Run ruff checks.
	$(UV_RUN) ruff check src tests

typecheck: ## Run mypy checks.
	$(UV_RUN) mypy src

config-show: ## Print parsed config through the CLI, not the raw TOML file.
	$(OPENSQUILLA) config get --config $(CONFIG)

config-provider: ## Print only provider/model fields from the parsed config.
	$(OPENSQUILLA) config get llm.provider --config $(CONFIG)
	$(OPENSQUILLA) config get llm.model --config $(CONFIG)
	$(OPENSQUILLA) config get llm.base_url --config $(CONFIG)

clean-cache: ## Remove project-local uv cache.
	rm -rf $(UV_CACHE_DIR)

clean-runtime: ## Remove project-local OpenSquilla test runtime state and logs.
	rm -rf $(TEST_HOME)

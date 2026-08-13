# Development shortcuts. Everything runs in Docker: no PHP or Node needed on the host.
# This file is export-ignored — it never reaches a project installing the bundle.

UID := $(shell id -u)
GID := $(shell id -g)
export UID
export GID

DC := docker compose
PHP := $(DC) run --rm php

.DEFAULT_GOAL := help

.PHONY: help
help: ## Liste les commandes disponibles
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Installe les dépendances PHP et publie les assets du bundle
	$(PHP) composer install
	$(PHP) php dev-app/bin/console assets:install dev-app/public

.PHONY: up
up: ## Démarre la playground (http://localhost:8123) et le watcher d'assets
	$(DC) up -d
	@echo "Playground : http://localhost:$${PLAYGROUND_PORT:-8123}"

.PHONY: down
down: ## Arrête la stack
	$(DC) down

.PHONY: logs
logs: ## Suit les logs des deux services
	$(DC) logs -f

.PHONY: sh
sh: ## Ouvre un shell dans le conteneur PHP
	$(PHP) sh

.PHONY: assets
assets: ## Compile les assets de la playground une fois (sans watcher)
	$(DC) run --rm node sh -c "npm install && npm run build"

.PHONY: lint
lint: ## Valide composer.json et la syntaxe PHP
	$(PHP) composer validate --strict
	$(PHP) sh -c 'find src dev-app/src -name "*.php" -exec php -l {} \; | grep -v "No syntax errors" || true'

.PHONY: clean
clean: ## Supprime les artefacts de build
	rm -rf vendor dev-app/node_modules dev-app/public/build dev-app/public/bundles dev-app/var

.PHONY: copy-env up down logs ps test worker-shell vault-shell frontend-shell seed

copy-env:
	cp -n .env.example .env || true

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=150

ps:
	docker compose ps

test:
	docker compose run --rm vault pytest -q

worker-shell:
	docker compose run --rm rotation-worker sh

vault-shell:
	docker compose run --rm vault sh

frontend-shell:
	docker compose run --rm frontend sh

seed:
	docker compose run --rm vault python -m app.bootstrap.seed

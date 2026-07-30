.PHONY: start-backend start-web start-mobile install install-backend install-web install-mobile \
        db-up db-down migrate migrate-auto migrate-down docker-build

# ── Database ──────────────────────────────────────────────────────────────────
db-up:
	docker compose up -d

db-down:
	docker compose down

# ── Alembic migrations ────────────────────────────────────────────────────────
# Apply all pending migrations
migrate:
	cd backend && poetry run alembic upgrade head

# Auto-generate a new migration from model changes
# Usage: make migrate-auto MSG="add foo column"
migrate-auto:
	cd backend && poetry run alembic revision --autogenerate -m "$(MSG)"

# Roll back the last migration
migrate-down:
	cd backend && poetry run alembic downgrade -1

# ── Backend ───────────────────────────────────────────────────────────────────
install-backend:
	cd backend && poetry install

start-backend:
	cd backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Build the production Docker image
docker-build:
	docker build -t mechai-backend:latest ./backend

# ── Frontend Web ──────────────────────────────────────────────────────────────
install-web:
	cd frontend-web && npm install

start-web:
	cd frontend-web && npm run dev

# ── Frontend Mobile ───────────────────────────────────────────────────────────
install-mobile:
	cd frontend-mobile && npm install

start-mobile:
	cd frontend-mobile && npm run start

# ── Convenience ───────────────────────────────────────────────────────────────
install: install-backend install-web install-mobile

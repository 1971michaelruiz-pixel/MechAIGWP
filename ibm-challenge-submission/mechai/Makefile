.PHONY: start-backend start-web start-mobile install install-backend install-web install-mobile db-up db-down

# ── Database ──────────────────────────────────────────────────────────────────
db-up:
	docker compose up -d

db-down:
	docker compose down

# ── Backend ───────────────────────────────────────────────────────────────────
install-backend:
	cd backend && poetry install

start-backend:
	cd backend && poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

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

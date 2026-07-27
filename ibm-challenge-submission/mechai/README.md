# MechAI — Mechanic Speak Platform

AI-powered automotive assistant that converts plain-language vehicle symptom descriptions into structured diagnostic reports, repair estimates, and multi-shop appointment workflows.

---

## Monorepo Structure

```
mechai/
├── backend/            # Python · FastAPI · Uvicorn · Poetry
├── frontend-web/       # Vite · React · TypeScript
├── frontend-mobile/    # Expo · React Native
├── docker-compose.yml  # Local PostgreSQL
└── Makefile            # Developer shortcuts
```

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Python | ≥ 3.11 |
| Poetry | ≥ 1.8 |
| Node.js | ≥ 20 |
| pnpm / npm | any recent |
| Docker + Compose | any recent |
| Expo CLI | ≥ 7 |

### 1 — Start the database

```bash
docker compose up -d
```

### 2 — Start all services (individual terminals)

```bash
make start-backend
make start-web
make start-mobile
```

---

## Environment Variables

Copy the `.env.example` file in each package to `.env` and fill in the values before running.

```bash
cp backend/.env.example        backend/.env
cp frontend-web/.env.example   frontend-web/.env
cp frontend-mobile/.env.example frontend-mobile/.env
```

---

## Multi-Tenancy

All database tables that contain shop-specific data carry a `shop_id` column (UUID, foreign-key to the `shops` table). Row-level security policies and application-layer guards enforce tenant isolation. The schema and guards are implemented in **Sub-Task 2** (database layer).

---

## Auth

Authentication is handled by **Supabase Auth** (JWT). The backend validates the JWT on every protected request; the frontend reads the token from Supabase's client SDK and passes it as `Authorization: Bearer <token>`.

---

## Contributing

1. Create a feature branch from `main`.
2. Keep packages independent — avoid cross-package imports.
3. All API changes require an update to the OpenAPI spec comment in `backend/app/main.py`.

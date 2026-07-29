# MechAI — Mechanic Speak

> **Voice-first AI diagnostic assistant for automotive repair shops.**  
> Describe the symptom out loud. MechAI decodes the VIN, pulls service history, cross-references TSBs, and delivers ranked repair recommendations — hands-free, on the mechanic's own phone.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Monorepo Structure](#monorepo-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1 · Start the database](#1--start-the-database)
  - [2 · Configure environment variables](#2--configure-environment-variables)
  - [3 · Install dependencies](#3--install-dependencies)
  - [4 · Run the services](#4--run-the-services)
- [Environment Variables Reference](#environment-variables-reference)
- [API Overview](#api-overview)
- [RepairDataProvider Interface](#repairdataprovider-interface)
- [Dialect Learning System](#dialect-learning-system)
- [Multi-Tenancy & Security](#multi-tenancy--security)
- [Database Schema](#database-schema)
- [Contributing](#contributing)

---

## Overview

MechAI is a cloud-hosted, multi-tenant SaaS platform that removes friction from automotive shop intake and diagnosis. The core workflow:

1. **Mechanic speaks** — vehicle VIN, customer name, and symptoms, hands-free from their own phone
2. **MechAI transcribes** — via OpenAI Whisper, seeded with shop-specific dialect vocabulary
3. **Dialect normalization** — regional slang ("tranny slipping", "front end shimmy") is canonicalized before NLP processing
4. **LLM extraction** — GPT-4o extracts VIN, customer, presented symptoms, and inspection findings as structured JSON
5. **VIN decode** — NHTSA vPIC public API returns make, model, year, trim, and engine at no cost
6. **History retrieval** — the vehicle's full service record is fetched automatically
7. **Diagnosis engine** — symptom tags are matched against the configured `RepairDataProvider`; GPT-4o synthesizes ranked, plain-language repair recommendations with source citations
8. **Service writer review** — results surface on the desktop web app for review, editing, and PDF export

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      MECHANIC'S PHONE                        │
│           React Native App (iOS + Android / Expo)            │
│      [ Push-to-Talk Button ]  [ Session Status Display ]     │
└─────────────────────────┬────────────────────────────────────┘
                          │  Audio stream (WAV / M4A)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND API (FastAPI)                      │
│                                                              │
│  ┌────────────────┐   ┌────────────────────────────────────┐ │
│  │ Speech-to-Text │   │       Session Orchestrator         │ │
│  │ (Whisper API)  │──▶│  1. Transcribe                     │ │
│  └────────────────┘   │  2. Normalize dialect              │ │
│                        │  3. Extract VIN / customer /      │ │
│  ┌────────────────┐   │     symptoms (GPT-4o)              │ │
│  │ Dialect        │   │  4. Decode VIN (NHTSA)             │ │
│  │ Normalizer     │   │  5. Fetch / create vehicle profile │ │
│  └────────────────┘   │  6. Assign customer                │ │
│                        │  7. Store service record           │ │
│  ┌────────────────┐   │  8. Run diagnosis engine           │ │
│  │ LLM (GPT-4o)  │   │  9. Return ranked solutions        │ │
│  └────────────────┘   └────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼──────────────────┐
          ▼               ▼                  ▼
 ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐
 │ PostgreSQL   │  │ NHTSA vPIC    │  │ Any Repair API   │
 │ (Supabase)  │  │ (free/public) │  │ (pluggable via   │
 │ + pgvector  │  │ VIN decode    │  │ RepairData-      │
 └──────────────┘  └───────────────┘  │ Provider)        │
          │                            └──────────────────┘
          ▼
┌──────────────────────────────────────────────────────────────┐
│               SERVICE WRITER DESKTOP (Web)                   │
│          React + TypeScript + Vite (Browser)                 │
│  [ Customer Roster ]  [ Vehicle History ]  [ Diagnosis ]     │
│  [ Dialect Admin ]    [ Session Summary ]  [ PDF Export ]    │
└──────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
mechai/
├── backend/                  # Python · FastAPI · Uvicorn · Poetry
│   ├── app/
│   │   ├── main.py           # FastAPI app + router registration
│   │   ├── config.py         # Pydantic settings
│   │   ├── db.py             # SQLAlchemy engine + session
│   │   ├── models/           # ORM models (vehicle, customer, session, …)
│   │   ├── routers/          # Route handlers (transcribe, diagnose, dialect, …)
│   │   ├── services/         # Business logic (session_orchestrator, diagnose, …)
│   │   ├── providers/        # RepairDataProvider implementations
│   │   └── seeds/            # Dialect seed data
│   ├── pyproject.toml
│   └── .env.example
├── frontend-web/             # Vite · React 18 · TypeScript
│   ├── src/
│   │   ├── components/       # VoiceCaptureButton, DiagnosisPanel, DialectAdmin, …
│   │   └── pages/            # HomePage, SessionWorkflowPage
│   └── .env.example
├── frontend-mobile/          # Expo SDK 51 · React Native 0.74
│   ├── app/                  # Expo Router screens (voice, session, history, …)
│   └── .env.example
├── docker-compose.yml        # Local PostgreSQL 16
└── Makefile                  # Developer shortcuts
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python 3.11+ · FastAPI 0.111 · Uvicorn |
| Mobile App | React Native 0.74 · Expo SDK 51 (iOS + Android) |
| Web App | React 18 · TypeScript · Vite 5 |
| Database | PostgreSQL 16 · pgvector · Supabase (RLS multi-tenancy) |
| Speech-to-Text | OpenAI Whisper API (`whisper-1`) — swappable via `SpeechProvider` |
| LLM | OpenAI GPT-4o — swappable to IBM watsonx.ai |
| VIN Decode | NHTSA vPIC public API (free, no key required) |
| Auth | Supabase Auth (JWT · RBAC) |
| Repair Data | Pluggable `RepairDataProvider` — NHTSA built-in; any provider connectable |
| PDF Export | Python `reportlab` |
| Linting | `ruff` (Python) · ESLint (TypeScript) |

---

## Getting Started

### Prerequisites

| Tool | Version |
|---|---|
| Python | ≥ 3.11 |
| Poetry | ≥ 1.8 |
| Node.js | ≥ 20 |
| npm | any recent |
| Docker + Compose | any recent |
| Expo CLI | ≥ 7 |

### 1 · Start the database

```bash
# from the mechai/ root
docker compose up -d
```

This starts a local PostgreSQL 16 container at `localhost:5432` with database `mechai`.  
The backend creates all tables automatically on first start (dev mode via SQLAlchemy `create_all`).

### 2 · Configure environment variables

Copy each `.env.example` to `.env` and fill in the required values:

```bash
cp backend/.env.example         backend/.env
cp frontend-web/.env.example    frontend-web/.env
cp frontend-mobile/.env.example frontend-mobile/.env
```

See [Environment Variables Reference](#environment-variables-reference) for details.

### 3 · Install dependencies

```bash
make install
```

This runs `poetry install` for the backend and `npm install` for both frontends.

### 4 · Run the services

Open three terminals (or use your preferred process manager):

```bash
make start-backend   # FastAPI on http://localhost:8000
make start-web       # Vite dev server on http://localhost:5173
make start-mobile    # Expo dev server (scan QR with Expo Go)
```

Interactive API docs are available at `http://localhost:8000/docs` in development mode.

---

## Environment Variables Reference

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase public anon key |
| `SUPABASE_JWT_SECRET` | ✅ | Used server-side for JWT verification — **keep secret** |
| `OPENAI_API_KEY` | ✅ | Powers Whisper STT and GPT-4o extraction / synthesis |
| `WHISPER_MODEL` | ❌ | Whisper model name (default: `whisper-1`) |
| `APP_ENV` | ❌ | `development` or `production` (disables `/docs` in production) |
| `LOG_LEVEL` | ❌ | Uvicorn log level (default: `info`) |

---

## API Overview

All routes are prefixed under the FastAPI app root. Swagger UI available at `/docs`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/transcribe` | Upload audio → returns transcript + session ID |
| `POST` | `/sessions` | Start / advance a session state machine |
| `GET` | `/sessions/{id}` | Fetch session state and results |
| `POST` | `/diagnose` | Run diagnosis engine against symptom tags |
| `GET/POST` | `/vehicles` | Vehicle lookup and creation |
| `GET/POST` | `/customers` | Customer search and creation |
| `GET/POST` | `/service-records` | Service history for a vehicle |
| `GET/POST` | `/dialect` | Dialect term lookup and candidate submission |

---

## RepairDataProvider Interface

The diagnosis engine is data-source agnostic. Any repair data backend implements three methods:

```python
class RepairDataProvider(ABC):
    def search_tsbs(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[TSBRecord]: ...

    def search_community_threads(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[CommunityThread]: ...

    def get_labor_hours(self, tsb_id: str) -> float | None: ...
```

**Built-in providers:**

| Provider | Description |
|---|---|
| `NHTSAProvider` | Queries NHTSA public complaint data — free, no API key |
| `ImportedDataProvider` | Reads shop-uploaded TSBs from the local `tsb_records` table |
| `GenericAPIProvider` | Configurable HTTP adapter for any commercial repair REST API |

The active provider is selected per tenant in `tenant_settings`. Third-party providers (Mitchell1, Identifix, AutoZone Pro) can be added as separate packages without touching platform code.

---

## Dialect Learning System

Mechanics speak differently by region — "shimmy in the front end", "cherry bomb", "tranny slipping" are not standard automotive terminology. MechAI handles this in two stages:

1. **Transcription bias** — the Whisper `initial_prompt` is seeded with approved `dialect_terms` so the STT model already favors known mechanic vocabulary
2. **Post-transcription normalization** — a middleware layer replaces raw slang with canonical terms before any LLM processing (e.g. `"tranny"` → `"transmission"`)

Unknown terms encountered during transcription are written to `dialect_candidates` for human review. Shop managers approve new terms via the **Dialect Admin Panel** in the web app. Approved terms increment their `usage_count` with each match, enabling future regional model tuning.

---

## Multi-Tenancy & Security

- **Row-Level Security (RLS)** enforced at the PostgreSQL layer — every query is automatically scoped to `shop_id`
- **JWT authentication** via Supabase Auth with three roles: `admin`, `mechanic`, `writer`
- Audio files stored in encrypted S3 buckets with presigned URLs (never publicly accessible)
- All API traffic over HTTPS (TLS 1.3)
- PII fields (customer name, phone, email) isolated per shop partition

---

## Database Schema

Key tables (abbreviated):

```sql
shops              (id, name, theme_config, created_at)
tenant_settings    (id, shop_id, repair_data_provider, generic_api_url, generic_api_key)
users              (id, shop_id, role, name, email)
vehicles           (id, vin, make, model, year, trim, engine, body_style, shop_id)
customers          (id, shop_id, first_name, last_name, phone, email)
customer_vehicles  (customer_id, vehicle_id, assigned_at, is_current_owner)
service_records    (id, vehicle_id, shop_id, mechanic_id, visit_date,
                    presented_symptoms, inspection_findings, symptom_tags jsonb, status)
tsb_records        (id, make, model, year_min, year_max, symptom_tags,
                    diagnosis, repair_procedure, labor_hours, tsb_number,
                    provider_source, embedding vector(1536))
community_threads  (id, vehicle_tags, symptom_tags, thread_summary,
                    resolution, source_url, provider_source, embedding vector(1536))
dialect_terms      (id, raw_term, canonical_term, category, region,
                    approved, usage_count, created_at)
dialect_candidates (id, raw_term, context_snippet, shop_id, occurrence_count)
sessions           (id, shop_id, mechanic_id, vehicle_id, customer_id,
                    service_record_id, state, transcript_ids jsonb, created_at)
```

---

## Contributing

1. Create a feature branch from `main`.
2. Keep packages independent — avoid cross-package imports between `backend`, `frontend-web`, and `frontend-mobile`.
3. All API changes require an update to the OpenAPI spec comment in [`backend/app/main.py`](backend/app/main.py).
4. Run linters before opening a PR:
   ```bash
   # Backend
   cd backend && poetry run ruff check .

   # Web
   cd frontend-web && npm run lint

   # Mobile
   cd frontend-mobile && npm run lint
   ```

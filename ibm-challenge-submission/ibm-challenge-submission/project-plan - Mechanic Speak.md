# Mechanic AI Platform — Full Project Plan
### (Technical Reference Document for IBM July Challenge Submission)

> This document contains the complete technical build plan for MechAI.
> It is included as a reference to demonstrate the depth of planning and architecture behind the submission.

---

# Mechanic AI Platform — Project Plan

## Top-Level Overview

Build a voice-first AI platform for automotive mechanics that:
1. Accepts spoken input describing a VIN, customer-presented symptoms, and inspection findings
2. Builds and maintains a vehicle profile (keyed on VIN) linked to a customer record
3. Pulls vehicle service history from the platform's own database
4. Queries a pluggable **repair data provider** for TSBs, labor guides, and community symptom data
5. Surfaces at least two ranked repair solutions based on matched symptoms
6. Learns and grows a regional mechanic dialect / jargon database to improve speech recognition accuracy over time

### Deployment Model — Direct B2B SaaS (Provider-Agnostic)

The platform is sold **directly to automotive repair shops** as a SaaS subscription. Any repair data provider (e.g. ALLDATA, Mitchell1, Identifix, AutoZone Pro, or a shop's own imported data) can be connected via the `RepairDataProvider` plugin interface. The architecture must therefore be:
- **Multi-tenant from day one** — every shop is an isolated tenant (`shop_id` on every table, row-level security enforced at the DB layer)
- **White-label ready** — branding, logo, and color theming configurable per tenant or reseller
- **Provider-agnostic data backbone** — repair data is sourced through a standardised `RepairDataProvider` interface; NHTSA public TSB data is the built-in fallback and MVP default
- **Bring-your-own-data** — shops or data providers can import TSB/repair data via CSV or JSON import endpoints

### Repair Data Provider Interface

The `RepairDataProvider` interface is the central abstraction that decouples the diagnosis engine from any specific data vendor. Each provider implementation must satisfy the same contract:

```
RepairDataProvider
  └── search_tsbs(make, model, year, symptom_tags) → List[TSBRecord]
  └── search_community_threads(make, model, year, symptom_tags) → List[CommunityThread]
  └── get_labor_hours(tsb_id) → float | None
```

Built-in providers shipped with the platform:

| Provider | Type | Notes |
|---|---|---|
| `NHTSAProvider` | Free / public | Default MVP provider; uses NHTSA public TSB data |
| `ImportedDataProvider` | Shop-uploaded | CSV/JSON import; stored in `tsb_records` table |
| `GenericAPIProvider` | Configurable | HTTP adapter for any REST repair data API; configured per tenant |

Third-party commercial providers (ALLDATA, Mitchell1, Identifix, etc.) plug in as separate packages that implement `RepairDataProvider`. No core platform changes are needed to add a new provider.

### Mechanic Device Model

- The **mechanic's personal phone** is the primary voice capture device (iOS and Android, both from day one via Expo)
- The **service writer's desktop browser** is the management and review station
- No proprietary hardware required — any smartphone with a microphone works
- The mobile app must work in **noisy shop environments** — noise suppression and push-to-talk are essential

### Recommended Stack

| Layer | Technology | Reason |
|---|---|---|
| Backend API | **Python / FastAPI** | Best ecosystem for AI, NLP, and async I/O; large library support for speech and ML |
| Frontend (Desktop) | **React + TypeScript + Vite** | Fast, component-based, works well with voice Web APIs |
| Frontend (Mobile) | **React Native (Expo)** | Single codebase for iOS and Android; native microphone access via `expo-av` |
| Database | **PostgreSQL** (Supabase hosted) | Relational for customer/vehicle/history; row-level security for multi-tenancy |
| Multi-Tenancy | **Row-Level Security (RLS)** on PostgreSQL | Every query automatically scoped to `shop_id`; enforced at DB layer |
| Vector / Semantic Search | **pgvector** (PostgreSQL extension) | Stores dialect and symptom embeddings in same DB; no extra infrastructure |
| Speech-to-Text | **OpenAI Whisper API** | MVP choice — abstracted behind a `SpeechProvider` interface for future IBM Watson swap |
| LLM / Reasoning | **OpenAI GPT-4o** (via API) | Symptom matching, solution generation, structured JSON output; swappable to IBM watsonx.ai |
| VIN Decoding | **NHTSA vPIC API** (free, public) | Official US government VIN decode endpoint; no license required |
| Repair Data | **`RepairDataProvider` interface** | Pluggable; NHTSA public TSBs built in; commercial providers added as separate packages |
| Cloud Hosting | **AWS** (EC2 + RDS or Supabase cloud) | Mature, scalable; swappable to IBM Cloud for production |
| Auth | **Supabase Auth** (JWT + RLS) | Built-in multi-tenant auth; supports shop admin and mechanic roles |

### Compliance Flag
Customer PII (name, contact, vehicle ownership) is stored. A formal SOC 2 / state privacy law (CCPA etc.) review should be conducted before production launch. Because the platform is sold directly to shops, the platform operator owns the compliance posture. Individual data provider integrations may carry their own licensing terms and must be reviewed per provider.

---

## Sub-Tasks

### Sub-Task 1 — Project Scaffolding & Monorepo Setup
**Status** — `[x] complete`

**Intent**: Establish the full project structure so that all subsequent sub-tasks have a consistent, runnable foundation.

**Expected Outcomes**
- Monorepo with `backend/`, `frontend-web/`, `frontend-mobile/` packages
- Python FastAPI backend boots with a `/health` endpoint
- React web app boots with a placeholder page
- React Native (Expo) app boots on a device/emulator
- PostgreSQL database reachable from the backend
- Environment variable strategy in place

**Todo List**
1. Initialize git repo and create root `README.md`
2. Create `backend/` — Python project with `pyproject.toml` (Poetry), FastAPI, Uvicorn, and a `/health` route
3. Create `frontend-web/` — Vite + React + TypeScript scaffold
4. Create `frontend-mobile/` — Expo + React Native scaffold
5. Create `docker-compose.yml` at root to spin up PostgreSQL locally
6. Create `.env.example` files for each package documenting required variables
7. Add root `Makefile` with `start-backend`, `start-web`, `start-mobile` commands

---

### Sub-Task 2 — Voice Capture & Speech-to-Text Pipeline
**Status** — `[x] complete`

**Intent**: Give the mechanic a hands-free voice interface. Capture microphone audio, stream to backend, transcribe via Whisper, return structured text ready for NLP processing.

**Expected Outcomes**
- Web app has a push-to-talk UI component
- Mobile app has an equivalent voice capture screen
- Backend `/api/transcribe` endpoint accepts audio, calls Whisper, returns transcript
- Transcripts stored against a session ID for auditability
- Target latency: transcript returned within 3 seconds for a 30-second clip

**Todo List**
1. Add Whisper integration to backend (OpenAI Whisper API)
2. Build `POST /api/transcribe` — accepts multipart audio, returns `{ session_id, transcript, confidence }`
3. Build `VoiceCaptureButton` React component (Web) using MediaRecorder API
4. Build `VoiceCaptureScreen` in React Native using `expo-av`
5. Wire both frontends to POST audio and display returned transcript for mechanic confirmation
6. Store raw transcript + audio reference in `transcription_sessions` table

---

### Sub-Task 3 — VIN Decoder & Vehicle Profile Builder
**Status** — `[x] complete`

**Intent**: Extract VIN from spoken input, decode via NHTSA vPIC API, create or update vehicle profile.

**Expected Outcomes**
- VIN reliably extracted from free-form transcript text
- NHTSA API returns structured vehicle data for any valid US VIN
- `vehicles` table record created or updated
- Mechanic sees confirmation card with decoded vehicle details
- Invalid VINs surface clear error with manual entry fallback

**Todo List**
1. Write VIN extraction utility — regex + LLM fallback
2. Integrate NHTSA vPIC API: `GET https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json`
3. Design `vehicles` table: `vin`, `make`, `model`, `year`, `trim`, `engine`, `body_style`
4. Build `POST /api/vehicles/decode` — returns decoded vehicle object
5. Build `POST /api/vehicles` — creates or upserts vehicle profile
6. Build `VehicleConfirmationCard` UI component with edit/confirm flow

---

### Sub-Task 4 — Customer Management & Vehicle Assignment
**Status** — `[x] complete`

**Intent**: Associate vehicle profiles with customer records via voice command or manual search.

**Expected Outcomes**
- `customers` table holds name, contact info, shop association
- "Assign to John Smith" triggers fuzzy customer match
- New customer creation available from web and mobile
- `customer_vehicles` join table tracks ownership history
- Desktop view shows full customer + vehicle roster

**Todo List**
1. Design `customers` table: `id`, `shop_id`, `first_name`, `last_name`, `phone`, `email`
2. Design `customer_vehicles` join table: `customer_id`, `vehicle_id`, `assigned_at`, `is_current_owner`
3. Build `GET /api/customers/search?q=` — fuzzy name/phone search
4. Build `POST /api/customers` — create new customer
5. Build `POST /api/customer-vehicles` — assign vehicle to customer
6. Build LLM extraction step: parse "assign to [name]" from transcript
7. Build `CustomerSearchPanel` UI component (web + mobile)

---

### Sub-Task 5 — Service History & Inspection Notes
**Status** — `[x] complete`

**Intent**: Capture two-phase voice intake (presented symptoms + inspection findings), store as structured service records, retrieve full history by VIN.

**Expected Outcomes**
- `service_records` table stores each visit with both symptom phases
- Two-phase voice capture flow in UI
- LLM extracts structured symptom tags from free-form speech
- `VehicleHistoryTimeline` UI component on web and mobile
- History retrieved automatically when VIN recognized

**Todo List**
1. Design `service_records` table: `id`, `vehicle_id`, `shop_id`, `mechanic_id`, `visit_date`, `presented_symptoms`, `inspection_findings`, `symptom_tags` (jsonb)
2. Build `POST /api/service-records`
3. Build `GET /api/vehicles/{vin}/history`
4. Add two-phase voice capture UI flow
5. LLM extraction of structured symptom tags
6. Build `VehicleHistoryTimeline` UI component

---

### Sub-Task 6 — Repair Data Provider Interface & Symptom Matching Engine
**Status** — `[x] complete`

**Intent**: Define the `RepairDataProvider` plugin interface, ship the built-in NHTSA provider as the MVP default, and build the diagnosis engine on top of it so any provider can be swapped in without touching core logic.

**Expected Outcomes**
- `RepairDataProvider` abstract base class defined in `backend/providers/base.py`
- `NHTSAProvider` implementation seeded with NHTSA public TSB data
- `ImportedDataProvider` implementation backed by shop-uploaded CSV/JSON
- `GenericAPIProvider` skeleton for configuring a third-party REST endpoint per tenant
- `tsb_records` and `community_threads` tables seeded with NHTSA data
- `POST /api/diagnose` returns ranked solution objects, provider-agnostic
- Each solution includes description, source citation, labor hours, confidence score
- `DiagnosisPanel` UI component with expandable solutions
- Provider configured per tenant in `tenant_settings` table

**Todo List**
1. Define `RepairDataProvider` abstract base class: `search_tsbs`, `search_community_threads`, `get_labor_hours`
2. Design `tsb_records` table: make/model/year range, symptom tags, diagnosis, repair procedure, labor hours, TSB number, `provider_source`
3. Design `community_threads` table: vehicle tags, symptom tags, thread summary, resolution, source URL, `provider_source`
4. Build `NHTSAProvider` — fetches and normalises NHTSA public TSB data into `tsb_records`
5. Build CSV/JSON import script → `ImportedDataProvider`
6. Build `GenericAPIProvider` skeleton with per-tenant HTTP config
7. Build symptom vector embeddings using pgvector
8. Build `POST /api/diagnose` with vector similarity search (provider-agnostic)
9. Add GPT-4o synthesis step for ranked plain-language solutions
10. Build `DiagnosisPanel` UI component
11. Add `tenant_settings.repair_data_provider` config field and provider resolution at runtime

---

### Sub-Task 7 — Regional Mechanic Dialect & Jargon Database
**Status** — `[x] complete`

**Intent**: Build a living language database of regional mechanic slang to improve STT accuracy and NLP understanding.

**Expected Outcomes**
- `dialect_terms` table with raw→canonical mappings, region tags, approval status
- Dialect vocabulary fed into Whisper `initial_prompt` at transcription time
- Dialect normalization middleware applied post-transcription
- Unknown terms flagged to `dialect_candidates` for review
- `DialectAdminPanel` UI for shop managers (desktop only)

**Todo List**
1. Design `dialect_terms` table: `raw_term`, `canonical_term`, `category`, `region`, `approved`, `usage_count`
2. Seed initial corpus from automotive forums and ASE study guides
3. Build dialect normalization middleware (post-transcription)
4. Integrate dialect vocabulary as Whisper `initial_prompt`
5. Build term flagging system → `dialect_candidates` table
6. Build `DialectAdminPanel` UI component
7. Add usage count tracking

---

### Sub-Task 8 — Unified Session Workflow & End-to-End Integration
**Status** — `[x] complete`

**Intent**: Wire all sub-tasks into a single coherent mechanic session from microphone press to diagnosis display.

**Expected Outcomes**
- Full voice-driven session: VIN → customer → symptoms → findings → diagnosis → summary
- Both web and mobile support the full flow
- Session state persisted for pause/resume
- PDF export of session summary

**Todo List**
1. Design `sessions` state machine: `[listening, vin_capture, customer_assign, symptom_intake, inspection_intake, diagnosing, complete]`
2. Build `POST /api/sessions` and `PATCH /api/sessions/{id}`
3. Build `SessionOrchestrator` backend service
4. Build `SessionWorkflowScreen` on web and mobile
5. Add session resume logic
6. Build session summary view
7. Add PDF export via Python `reportlab`

---

## Open Decisions & Flags

| # | Decision | Status |
|---|---|---|
| 1 | Repair data provider for MVP | **DECIDED — NHTSA public TSBs via `NHTSAProvider`; commercial providers plug in later** |
| 2 | PII / compliance review (SOC2, CCPA) | **Flagged — required before production launch; no external partner dependency** |
| 3 | Multi-tenant SaaS (direct B2B) | **DECIDED — direct shop subscriptions; `shop_id` RLS on all tables** |
| 4 | Whisper hosting | **DECIDED — OpenAI Whisper API for MVP; swappable to IBM Watson STT** |
| 5 | Mobile platform | **DECIDED — iOS and Android via Expo React Native; mechanic's personal phone** |
| 6 | Cloud region requirements | **Open — no external partner constraint; choose based on target shop geography** |
| 7 | White-label / reseller branding | **Open — theming configurable per tenant; reseller packages possible in future** |
| 8 | Commercial repair data provider onboarding | **Open — ALLDATA, Mitchell1, Identifix can each implement `RepairDataProvider`; no core changes needed** |

---

## Suggested Build Order

```
1 (Scaffolding) → 2 (Voice/STT) → 3 (VIN) → 4 (Customer) → 5 (History) → 7 (Dialect DB) → 6 (Repair Data Provider + Diagnosis) → 8 (Integration)
```

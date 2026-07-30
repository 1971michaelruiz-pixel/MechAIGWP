# Technical Architecture — MechAI

## System Overview

MechAI is a cloud-hosted, multi-tenant SaaS platform consisting of three components:
1. A **mobile app** (mechanic's smartphone — iOS and Android)
2. A **web app** (service writer's desktop browser)
3. A **backend API** with AI pipelines, database, and pluggable repair data providers

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        MECHANIC'S PHONE                         │
│              React Native App (iOS + Android / Expo)            │
│         [ Push-to-Talk Button ] [ Session Status Display ]      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Audio stream (WAV/M4A)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API (FastAPI)                       │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │  Speech-to-Text  │    │     Session Orchestrator          │   │
│  │  (Whisper API)   │───▶│  1. Transcribe                   │   │
│  └─────────────────┘    │  2. Normalize dialect             │   │
│                          │  3. Extract VIN / customer /      │   │
│  ┌─────────────────┐    │     symptoms                      │   │
│  │ Dialect          │    │  4. Decode VIN (NHTSA)            │   │
│  │ Normalizer       │    │  5. Fetch/create vehicle profile  │   │
│  │ (dialect_terms   │    │  6. Assign customer               │   │
│  │  table)          │    │  7. Store service record          │   │
│  └─────────────────┘    │  8. Run diagnosis engine          │   │
│                          │  9. Return ranked solutions       │   │
│  ┌─────────────────┐    └──────────────────────────────────┘   │
│  │  LLM Reasoning   │                                           │
│  │  (GPT-4o)        │    ┌──────────────────────────────────┐   │
│  │  - Extraction    │    │     Diagnosis Engine              │   │
│  │  - Synthesis     │    │  RepairDataProvider interface:    │   │
│  └─────────────────┘    │  - NHTSAProvider (default/free)   │   │
│                          │  - ImportedDataProvider (CSV/JSON)│   │
└──────────────────────────│  - GenericAPIProvider (any REST)  │───┘
                           │  + GPT-4o solution synthesis      │
                           └──────────────────────────────────┘
                                          │
              ┌───────────────────────────┼──────────────────────┐
              ▼                           ▼                      ▼
   ┌──────────────────┐      ┌──────────────────┐  ┌──────────────────┐
   │  PostgreSQL DB   │      │   NHTSA vPIC API │  │  Any Repair API  │
   │  (Supabase)      │      │   (Free/Public)  │  │  (pluggable via  │
   │  - vehicles      │      │   VIN decode     │  │  GenericAPI-     │
   │  - customers     │      └──────────────────┘  │  Provider)       │
   │  - service_recs  │                             └──────────────────┘
   │  - tsb_records   │
   │  - dialect_terms │
   │  - sessions      │
   └──────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SERVICE WRITER DESKTOP (Web)                  │
│              React + TypeScript + Vite (Browser)                │
│  [ Customer Roster ] [ Vehicle History ] [ Diagnosis Panel ]    │
│  [ Dialect Admin ]   [ Session Summary ] [ PDF Export ]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Voice Capture Layer
- **Mobile**: React Native (Expo) app using `expo-av` for microphone access
- **Web**: React app using the browser `MediaRecorder` API
- Push-to-talk primary mode; continuous listening optional
- Audio noise suppression applied before upload for shop environment performance
- Audio sent as multipart POST to `/api/transcribe`

### 2. Speech-to-Text (STT) Pipeline
- **Engine**: OpenAI Whisper API (MVP); abstracted behind a `SpeechProvider` interface for future swap to IBM Watson Speech to Text
- Whisper `initial_prompt` is seeded with dialect vocabulary from the `dialect_terms` table to bias transcription toward known mechanic terminology
- Returns: raw transcript text + confidence score + session ID

### 3. Dialect Normalization Layer
- Post-transcription middleware
- Replaces known regional slang with canonical automotive terminology before any NLP processing
- Example: "shimmy in the front end" → "front suspension vibration"; "tranny" → "transmission"
- Unknown terms are flagged to the `dialect_candidates` table for human review
- Shop managers approve new terms via the Dialect Admin Panel (desktop only)

### 4. LLM Extraction Layer (GPT-4o)
- Receives normalized transcript
- Extracts structured data:
  - **VIN**: 17-character string, with regex + LLM fallback
  - **Customer name**: fuzzy-matched against existing customers
  - **Presented symptoms**: customer-reported complaints (tagged and embedded)
  - **Inspection findings**: mechanic-observed issues (tagged and embedded)
- Returns structured JSON consumed by downstream services

### 5. VIN Decoder
- Calls NHTSA vPIC public API: `GET https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json`
- Returns: make, model, year, trim, engine type, body style, manufacturer
- Creates or updates the `vehicles` table record
- No API key required; free and publicly maintained by the US government

### 6. Customer & Vehicle Profile Management
- Fuzzy name/phone search against `customers` table (scoped to `shop_id`)
- Voice command "assign to [name]" triggers customer lookup
- New customer creation available via voice prompt or manual form
- `customer_vehicles` join table tracks ownership history over time

### 7. Service History & Session Storage
- Two-phase voice intake: "presented symptoms" phase + "inspection findings" phase
- LLM extracts structured symptom tags from free-form speech
- All records stored in `service_records` table with full audit trail
- Vehicle history retrieved automatically when VIN is recognized

### 8. Diagnosis Engine
- Symptom tags are matched via the active `RepairDataProvider` for the shop
- GPT-4o synthesises findings into ranked, plain-language repair recommendations
- Each solution includes: plain-language description, source citation (TSB or thread), estimated labor hours, confidence score
- The `RepairDataProvider` interface allows any data source to be plugged in per tenant with no core changes

### 9. RepairDataProvider Interface
- `NHTSAProvider` — built-in default; queries NHTSA public complaint data; no API key, no license
- `ImportedDataProvider` — reads shop-uploaded TSBs from the local `tsb_records` table
- `GenericAPIProvider` — configurable HTTP adapter for any commercial repair REST API
- Third-party providers (Mitchell1, Identifix, etc.) implement the same interface as separate packages
- Provider configured per tenant in the `tenant_settings` table

### 10. Dialect Database
- `dialect_terms` table: raw term, canonical term, category (part/symptom/action), region tag, approval status, usage count
- Seeded with initial corpus from automotive forums and ASE study materials
- Self-improving: usage counts track which terms appear most in real transcripts
- Regional tagging enables future per-region model tuning
- Admin UI for shop managers to review and approve candidate terms

---

## Database Schema (Key Tables)

```sql
-- Multi-tenancy anchor
shops (id, name, theme_config, created_at)

-- Per-tenant configuration (repair data provider selection)
tenant_settings (id, shop_id, repair_data_provider,
                 generic_api_url, generic_api_key, updated_at)

-- Users (mechanics and service writers)
users (id, shop_id, role [mechanic|writer|admin], name, email)

-- Vehicles (keyed on VIN)
vehicles (id, vin, make, model, year, trim, engine, body_style, shop_id)

-- Customers
customers (id, shop_id, first_name, last_name, phone, email)

-- Vehicle ownership
customer_vehicles (customer_id, vehicle_id, assigned_at, is_current_owner)

-- Service visits
service_records (id, vehicle_id, shop_id, mechanic_id, visit_date,
                 presented_symptoms, inspection_findings, symptom_tags jsonb,
                 status, created_at)

-- Repair knowledge base (populated by any RepairDataProvider)
tsb_records (id, make, model, year_min, year_max, symptom_tags,
             diagnosis, repair_procedure, labor_hours, tsb_number,
             provider_source, embedding vector(1536))

-- Community thread data
community_threads (id, vehicle_tags, symptom_tags, thread_summary,
                   resolution, source_url, provider_source,
                   embedding vector(1536))

-- Dialect learning
dialect_terms (id, raw_term, canonical_term, category, region,
               approved, usage_count, created_at)
dialect_candidates (id, raw_term, context_snippet, shop_id, occurrence_count)

-- Voice sessions
transcription_sessions (id, shop_id, mechanic_id, audio_ref,
                         transcript, confidence, created_at)

-- Unified mechanic sessions (state machine)
sessions (id, shop_id, mechanic_id, vehicle_id, customer_id,
          service_record_id, state, transcript_ids jsonb, created_at)
```

---

## Security & Multi-Tenancy

- **Row-Level Security (RLS)** enforced at PostgreSQL layer — every query is automatically scoped to `shop_id`
- JWT authentication via Supabase Auth — shop admin, mechanic, and service writer roles
- Audio files stored in encrypted S3 buckets with presigned URLs (never publicly accessible)
- All API traffic over HTTPS (TLS 1.3)
- PII fields (customer name, phone, email) isolated per shop partition

---

## Technology Stack Summary

| Layer | Technology | Notes |
|---|---|---|
| Backend API | Python 3.12 + FastAPI | Async, high performance |
| Mobile App | React Native (Expo SDK 51) | iOS + Android from one codebase |
| Web App | React 18 + TypeScript + Vite | Desktop service writer view |
| Database | PostgreSQL 16 (Supabase) | RLS multi-tenancy + pgvector |
| STT | OpenAI Whisper API | Abstracted — swappable to IBM Watson STT |
| LLM | OpenAI GPT-4o | Abstracted — swappable to IBM watsonx.ai |
| VIN Decode | NHTSA vPIC (public API) | Free, no key required |
| Vector Search | pgvector extension | Semantic symptom matching |
| Repair Data | `RepairDataProvider` interface | NHTSA built-in; any provider pluggable |
| Auth | Supabase Auth (JWT) | Role-based access control |
| Cloud | AWS (EC2 + S3 + RDS or Supabase Cloud) | Production deployment |
| PDF Export | Python reportlab | Server-side session summary export |

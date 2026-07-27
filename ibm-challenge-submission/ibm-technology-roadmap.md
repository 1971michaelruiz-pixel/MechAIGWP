# IBM Technology Roadmap — MechAI

## Overview

MechAI is built for rapid MVP development using the fastest available AI tools. The production and enterprise path maps directly onto IBM's AI and cloud platform — making MechAI a natural fit for enterprise shop customers who require IBM's compliance posture, data governance, and support SLAs.

---

## MVP Stack → IBM Production Stack

| MVP Component | IBM Production Replacement | IBM Product | Key Benefit of IBM Version |
|---|---|---|---|
| OpenAI Whisper API | **IBM Watson Speech to Text** | Watson AI | Custom language model training; supports fine-tuning on mechanic dialect corpus; on-premise deployment option |
| OpenAI GPT-4o | **IBM watsonx.ai** (Granite models) | watsonx | Explainable AI outputs; enterprise data governance; no training data retention |
| AWS EC2 + S3 | **IBM Cloud** (VPC + Object Storage) | IBM Cloud | FedRAMP authorized; SOC 2 Type II |
| Supabase (PostgreSQL) | **IBM Cloud Databases for PostgreSQL** | IBM Cloud | Managed, enterprise SLA; automatic backups; compliance certifications |
| pgvector semantic search | **IBM Watson Discovery** | Watson AI | Pre-built NLP pipelines; document ingestion; automotive domain fine-tuning |
| Custom auth (JWT) | **IBM App ID** | IBM Cloud | Enterprise SSO; SAML federation for shop directory integration |
| Manual monitoring | **IBM Instana** | IBM Observability | Auto-instrumentation; AI-powered anomaly detection |

---

## Why IBM Watson Speech to Text Is Superior for MechAI

Standard STT systems are trained on general speech. IBM Watson STT offers:

1. **Custom Language Models** — Upload a corpus of automotive terminology, TSB language, and regional dialect terms. Watson trains a domain-specific model that outperforms general models on mechanic speech by a significant margin.

2. **Custom Acoustic Models** — Train on audio recorded in shop environments (engine noise, compressors, metal work) to improve accuracy in exactly the conditions MechAI operates in.

3. **On-Premise Deployment** — Watson STT can be deployed as a container on IBM Cloud Private or on-premise. This means **audio never leaves the shop's infrastructure** — a critical selling point for shops that handle customer PII and are subject to state privacy laws.

4. **Speaker Diarization** — Identifies different speakers, useful when a service writer and mechanic are both talking during intake.

---

## Why IBM watsonx.ai Is Superior for MechAI

1. **Explainable AI** — IBM watsonx.ai provides reasoning traces and confidence scores for its outputs. For a mechanic relying on AI repair recommendations, knowing *why* a solution was suggested (which TSB, which community pattern) is as important as the suggestion itself.

2. **No Training Data Retention** — IBM contractually guarantees that data sent to watsonx.ai is not used to train future models. For shops handling customer vehicle data, this is a compliance requirement.

3. **Granite Models** — IBM's Granite foundation models are optimized for structured data extraction and domain-specific reasoning — exactly what MechAI needs for VIN extraction, symptom tagging, and solution synthesis.

4. **watsonx Prompt Lab** — The dialect normalization and symptom extraction prompts can be managed, versioned, and tested in IBM's Prompt Lab, making it easier for engineering teams to maintain and improve the AI behavior over time.

---

## IBM Cloud Compliance Advantages

For a platform handling customer PII across 160,000+ automotive shops:

| Requirement | IBM Cloud Capability |
|---|---|
| SOC 2 Type II | ✅ IBM Cloud certified |
| HIPAA (if shop handles medical fleet vehicles) | ✅ IBM Cloud HIPAA-eligible services |
| FedRAMP (government fleet shop customers) | ✅ IBM Cloud FedRAMP Authorized |
| Data residency (US-only) | ✅ IBM Cloud US-only region deployment |
| GDPR (international expansion) | ✅ IBM Cloud EU data residency |
| Encryption at rest + in transit | ✅ IBM Key Protect (BYOK) |

---

## Migration Path: MVP → IBM Production

The MechAI architecture is designed for this transition from day one:

- The STT engine sits behind a `SpeechProvider` interface — swapping Whisper for Watson STT requires changing one configuration value, not rebuilding the pipeline
- The LLM sits behind a `LLMProvider` interface — swapping GPT-4o for IBM Granite requires changing the provider implementation, not the calling code
- The diagnosis engine uses the `RepairDataProvider` interface — connecting Watson Discovery or any IBM-hosted repair data index is a provider implementation, not a re-architecture

**No re-architecture required for production IBM deployment.** This was a deliberate design decision made at the planning stage.

---

## Proposed IBM Partnership Value Exchange

| MechAI Brings | IBM Brings |
|---|---|
| Automotive domain expertise and dialect database | Watson STT custom model training infrastructure |
| 160,000+ shop addressable market (direct B2B) | Enterprise compliance certifications |
| Real-world mechanic voice data corpus | watsonx.ai Granite model inference at scale |
| Provider-agnostic architecture (no vendor lock-in) | IBM Cloud global infrastructure |
| Novel NLP problem: trade dialect learning | IBM Research collaboration opportunity |

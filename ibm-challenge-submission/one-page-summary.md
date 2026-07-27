# One-Page Submission Summary — MechAI
### IBM July Challenge 2025

**Project Name**: MechAI — Voice-First Automotive Diagnostic Platform  
**Submitter**: [Your Full Name]  
**Contact**: [Your Email] | [Your Phone]  
**Date**: July 2025

---

## Problem

160,000+ independent auto repair shops rely on manual, keyboard-driven workflows for vehicle intake and diagnosis. Mechanics in noisy shop environments must stop work, type symptoms into systems that don't understand their regional dialect, and manually search repair databases for solutions. The result is wasted time, missed diagnoses, and inconsistent records.

## Solution

**MechAI** is a voice-first AI platform that lets a mechanic speak naturally into their personal smartphone to complete the entire vehicle intake and diagnostic workflow — in under 60 seconds.

The mechanic speaks. MechAI:
- Decodes the VIN and builds a vehicle profile
- Assigns the vehicle to the customer record
- Captures presented symptoms and inspection findings
- Searches repair data (NHTSA TSBs plus any connected provider) for matching cases
- Returns two or more ranked, plain-language repair recommendations
- Learns regional mechanic slang to improve accuracy over time

## Why It's Innovative

1. **Regional Dialect Database** — First automotive AI system to capture, learn, and normalize regional mechanic slang across US regions, improving both transcription accuracy and diagnostic matching
2. **Pluggable Repair Data Providers** — An open `RepairDataProvider` interface means any data source — NHTSA, shop-uploaded data, or any commercial repair API — connects without changing core platform logic
3. **Zero Hardware** — Runs entirely on the mechanic's existing personal smartphone; no proprietary devices or installation required
4. **VIN-Anchored History** — Every repair record follows the vehicle's VIN, enabling AI-powered cross-visit pattern detection

## IBM Technology Alignment

| Platform AI | IBM Production Path |
|---|---|
| Speech-to-Text | IBM Watson Speech to Text (custom language model for mechanic dialect) |
| LLM Reasoning | IBM watsonx.ai (Granite — explainable AI, no data retention) |
| Cloud Infrastructure | IBM Cloud (SOC2, FedRAMP, enterprise compliance) |
| Semantic Search | IBM Watson Discovery |

## Business Model

Direct **B2B SaaS** sold to automotive repair shops as a monthly subscription. Shops connect their preferred repair data source via the `RepairDataProvider` interface — NHTSA public data is included by default, and commercial providers can be plugged in as the platform grows. The data network effect compounds: every session improves the dialect database and symptom matching accuracy for all users.

## Status

- ✅ Architecture designed and documented
- ✅ Technical plan complete (8 sub-tasks defined and built)
- ✅ MVP development complete
- 🔄 IBM Watson STT custom model training: pending IBM collaboration

## What I'm Asking For

- Access to **IBM Watson Speech to Text** custom language model training for automotive dialect
- **IBM watsonx.ai** API credits for production deployment
- IBM Cloud infrastructure introduction for enterprise-grade hosting

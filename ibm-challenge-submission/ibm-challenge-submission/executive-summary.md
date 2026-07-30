# Executive Summary — MechAI

## The Problem

Every day, automotive mechanics across the United States lose significant time to manual, fragmented diagnostic workflows:

- A mechanic must **type or handwrite** vehicle and symptom information while their hands are dirty and their focus is on the car
- Finding relevant repair data requires **manual keyword searches** — the mechanic must already know what to search for
- **Regional slang and trade dialect** ("front end shimmy," "cherry bomb," "tranny slipping") are not recognized by standard systems, leading to miscommunication between mechanics, service writers, and databases
- **Vehicle history is siloed** — a shop may not know what was done to a vehicle two visits ago, let alone at another shop
- There is **no AI layer** between the mechanic's expertise and the repair data available to them

The result: slower diagnoses, missed repair opportunities, inconsistent customer records, and unnecessary labor time.

## The Opportunity

There are over **160,000 independent automotive repair shops** in the United States. The majority subscribe to repair information platforms — services that provide labor guides, Technical Service Bulletins (TSBs), and community diagnostic threads. None of these platforms offer a voice-first AI layer that speaks the mechanic's language and surfaces relevant repair data automatically.

## The Solution

**MechAI** is a voice-first AI diagnostic assistant that integrates directly into the mechanic's workflow with zero new hardware requirements. Using the mechanic's personal smartphone as the input device, MechAI:

1. **Listens** to the mechanic describe the vehicle VIN, customer complaints, and inspection findings
2. **Decodes** the VIN automatically using NHTSA vehicle data
3. **Profiles** the vehicle and links it to a customer record — by voice command
4. **Retrieves** the vehicle's full service history from the platform database
5. **Searches** repair data from any connected provider using semantic AI search — NHTSA public data by default, with any commercial repair API connectable via the `RepairDataProvider` interface
6. **Generates** two or more ranked, plain-language repair recommendations with source citations
7. **Learns** — a living dialect database captures regional mechanic slang and improves transcription accuracy over time

## Business Model

MechAI is a **direct B2B SaaS platform** sold to automotive repair shops on a monthly subscription. Shops bring their own repair data source via the open `RepairDataProvider` plugin interface — NHTSA public TSB data is included as the built-in default, and any commercial provider (Mitchell1, Identifix, AutoZone Pro, or others) can be connected without platform changes. This makes MechAI data-source agnostic and eliminates dependency on any single vendor relationship.

Revenue grows through:
- **Per-shop subscriptions** with tiered pricing based on seat count and provider connections
- **Data network effect** — the dialect database compounds with usage, increasing accuracy and retention
- **White-label and reseller tiers** — any repair data platform can offer MechAI as a premium AI feature for their own customers

## Competitive Differentiation

| Feature | MechAI | Existing Shop Management Tools |
|---|---|---|
| Voice-first intake | ✅ Core feature | ❌ None |
| Regional dialect learning | ✅ Built-in NLP | ❌ None |
| AI-ranked repair solutions | ✅ LLM-powered | ❌ Manual search only |
| Works on mechanic's own phone | ✅ Any smartphone | ❌ Proprietary terminals |
| VIN-anchored vehicle profile | ✅ Automatic decode | ⚠️ Manual entry |
| Service history intelligence | ✅ Cross-visit analysis | ⚠️ Basic record storage |
| Pluggable repair data providers | ✅ Open interface | ❌ Vendor lock-in |

## Impact

- **Time saved per intake session**: Estimated 10–15 minutes per vehicle (voice vs. manual entry + manual search)
- **Diagnostic accuracy**: AI cross-referencing of symptoms against TSBs and community data reduces missed diagnoses
- **Mechanic experience**: Hands-free, eyes-free workflow respects the physical reality of shop work
- **Shop profitability**: Faster diagnosis → faster repair → higher throughput → more revenue per bay per day

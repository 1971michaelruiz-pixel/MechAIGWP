# Slide Deck Outline — MechAI
### IBM July Challenge 2025

> Use this outline to build your PowerPoint or Google Slides presentation.
> Suggested tool: IBM Presentation Template or Google Slides with IBM color palette
> IBM Primary Colors: #0F62FE (IBM Blue), #161616 (Carbon Black), #FFFFFF (White)
> Suggested length: 7–10 slides, 3 minutes presentation time

---

## Slide 1 — The Problem
**Title**: "Every minute a mechanic spends searching is a minute a car isn't getting fixed."

**Content**:
- 160,000+ independent auto repair shops in the US
- Mechanics spend 20–30% of diagnostic time on manual data entry and manual database searching
- Regional dialect differences cause mismatches between mechanic descriptions and database terminology
- No AI layer exists between the mechanic's expertise and the repair data available to them

**Visual**: Photo of a mechanic under a hood, phone or keyboard nowhere in sight

---

## Slide 2 — The Solution
**Title**: "MechAI — Just speak. We handle the rest."

**Content**:
- Voice-first AI diagnostic assistant
- Works on any mechanic's personal smartphone — no new hardware
- Speaks the mechanic's language — including regional slang and trade dialect
- Returns ranked repair recommendations in under 60 seconds

**Visual**: Simple phone mockup showing push-to-talk button → diagnosis card flow

---

## Slide 3 — How It Works (The Flow)
**Title**: "From spoken words to ranked solutions in one session."

**Content** (numbered flow):
1. 🎙️ Mechanic speaks VIN + symptoms into phone
2. 🚗 System decodes VIN → builds vehicle profile
3. 👤 System assigns vehicle to customer record
4. 🔍 AI searches repair database for matching cases
5. 💡 Two or more ranked solutions returned with source citations

**Visual**: Flow diagram (use the architecture diagram from technical-architecture.md, simplified)

---

## Slide 4 — The Dialect Innovation
**Title**: "The only automotive AI that speaks like a mechanic."

**Content**:
- Mechanics in different US regions use completely different terms for the same problems
- "Front end shimmy" (Midwest) = "front suspension vibration" (standard)
- "Cherry bomb" (Southeast) = aftermarket muffler
- MechAI maintains a living regional dialect database
- Self-improving: every session adds to the knowledge base
- Feeds directly into voice recognition to improve accuracy before transcription begins

**Visual**: Map of US with sample dialect terms by region, arrows pointing to canonical equivalents

---

## Slide 5 — The Data Intelligence Layer
**Title**: "Provider-agnostic repair intelligence that gets smarter with every car."

**Content**:
- Open `RepairDataProvider` interface — any repair data source connects without platform changes
- NHTSA public TSB data built in as the free default — zero licensing barrier to launch
- Any commercial repair API (Mitchell1, Identifix, AutoZone Pro) plugs in as a provider
- Semantic AI search (not keyword search) — finds relevant TSBs even when the mechanic uses different words
- VIN-anchored vehicle history — the car's full repair story follows the VIN, not the customer

**Visual**: Split screen — left: mechanic typing keywords; right: mechanic speaking naturally → same result, faster

---

## Slide 6 — IBM Technology Roadmap
**Title**: "Built to run on IBM. Designed for enterprise scale."

**Content** (two-column: MVP vs Production):

| MVP (Demo) | IBM Production |
|---|---|
| OpenAI Whisper | IBM Watson Speech to Text + Custom Language Model |
| OpenAI GPT-4o | IBM watsonx.ai (Granite) |
| AWS Cloud | IBM Cloud (SOC2, FedRAMP) |
| pgvector search | IBM Watson Discovery |

- All AI providers abstracted behind interfaces — production IBM swap requires zero re-architecture
- IBM Watson STT custom model trained on mechanic dialect corpus = best-in-class shop accuracy
- IBM watsonx.ai explainable AI = mechanics know *why* a solution was recommended

**Visual**: IBM logo + watsonx logo + Watson STT logo

---

## Slide 7 — Business Model & Market
**Title**: "160,000 shops. Direct subscription. Zero hardware. No data vendor lock-in."

**Content**:
- **Distribution**: Direct B2B SaaS — shops subscribe directly
- **Market**: 160,000+ independent auto repair shops in the US
- **Model**: Monthly per-shop subscription; tiered by seat count and provider connections
- **Moat**: Dialect database compounds — more usage = better accuracy = higher retention
- **Hardware barrier**: $0 — mechanic's personal phone is the device
- **Data freedom**: Open `RepairDataProvider` interface — shops choose their data source, MechAI is never locked to one vendor

**Visual**: Funnel diagram — shop subscribers → MechAI platform → pluggable provider ecosystem

---

## Slide 8 — Demo
**Title**: "See it in action."

**Content**:
- Live or recorded demo of:
  - Mechanic speaks VIN → vehicle card appears
  - Mechanic describes symptoms → tags extracted and displayed
  - System returns two ranked repair suggestions with TSB citations
  - Dialect admin panel showing regional term approval flow
  - Session summary with PDF export

**Visual**: Screen recording or live demo

---

## Slide 9 — Team & Ask
**Title**: "What we're asking for."

**Content**:
- [Your name / team]
- Background: [Your automotive / tech experience]
- Current status: Architecture complete, MVP built
- **Ask from IBM**:
  - Access to IBM Watson STT custom model training for automotive dialect corpus
  - IBM watsonx.ai API credits for production deployment
  - IBM Cloud infrastructure introduction for enterprise-grade hosting

**Visual**: Team photo or headshots

---

## Appendix Slides (optional, for Q&A)

- **A1**: Full database schema
- **A2**: Detailed dialect database architecture
- **A3**: RepairDataProvider interface and pluggable provider roadmap
- **A4**: Competitive landscape deep dive
- **A5**: Privacy and compliance approach

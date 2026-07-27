# MechAI — Voice-First Automotive Diagnostic Platform
### IBM July Challenge 2025 Submission

**Submitted by:** [Your Name]  
**Date:** July 2025  
**Category:** AI / Industry Solutions / Automotive

---

## Quick Links
- [Executive Summary](./executive-summary.md)
- [Technical Architecture](./technical-architecture.md)
- [Innovation Brief](./innovation-brief.md)
- [IBM Technology Roadmap](./ibm-technology-roadmap.md)
- [Project Plan](./project-plan%20-%20Mechanic%20Speak.md)
- [Slide Deck Outline](./slide-deck-outline.md)

---

## What Is MechAI?

MechAI is a voice-first AI platform designed for automotive mechanics. A mechanic speaks naturally into their personal smartphone — describing the vehicle VIN, customer-reported symptoms, and inspection findings — and the platform does the rest:

- Decodes the VIN and builds a vehicle profile
- Assigns the vehicle to a customer record
- Pulls the vehicle's full service history
- Searches repair data from any connected provider using semantic AI search
- Returns **two or more ranked repair solutions** in plain language
- Learns regional mechanic dialects and jargon to improve accuracy over time

No proprietary hardware. No typing. No searching. Just speak.

---

## What Makes It Different

**Provider-agnostic repair data.** MechAI is the first automotive AI diagnostic platform built around an open `RepairDataProvider` interface. NHTSA public TSB data is built in by default — free, no license required. Any commercial repair data source connects as a provider plugin. No single data vendor owns the platform.

**Dialect intelligence.** A living regional dialect database maps mechanic slang to canonical automotive terminology, improving both transcription accuracy and diagnostic matching. The database compounds with usage — every session makes it better.

**Zero hardware.** Any iOS or Android smartphone is the mechanic's device. Any desktop browser is the service writer's workstation.

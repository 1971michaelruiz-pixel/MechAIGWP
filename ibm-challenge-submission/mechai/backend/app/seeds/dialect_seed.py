"""Seed script for the built-in automotive mechanic dialect corpus.

Contains 20 common slang → canonical mappings drawn from automotive forums,
ASE study guides, and common shop floor vernacular.  Terms are global
(``shop_id=None``) and pre-approved (``approved=True``) so they are active
immediately after seeding.

Usage (via the API):
    GET /api/dialect/seed   (dev / staging environments only)
"""

from sqlalchemy.orm import Session

from app.models.dialect_term import DialectTerm

# ── Seed corpus ────────────────────────────────────────────────────────────────

DIALECT_SEED: list[dict] = [
    {
        "raw_term": "warped rotors",
        "canonical_term": "brake rotor warping",
        "category": "brakes",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "shot struts",
        "canonical_term": "failed strut assemblies",
        "category": "suspension",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "milky oil",
        "canonical_term": "coolant contamination in oil",
        "category": "engine",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "death wobble",
        "canonical_term": "severe front-end oscillation",
        "category": "suspension",
        "region": "southeast_us",
        "approved": True,
    },
    {
        "raw_term": "valve tick",
        "canonical_term": "valve train noise",
        "category": "engine",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "blown head gasket",
        "canonical_term": "head gasket failure",
        "category": "engine",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "grabby brakes",
        "canonical_term": "brake pad aggressive bite / inconsistent braking force",
        "category": "brakes",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "lazy o2",
        "canonical_term": "slow-responding oxygen sensor",
        "category": "emissions",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "knock sensor code",
        "canonical_term": "detonation sensor fault code",
        "category": "engine",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "sticky caliper",
        "canonical_term": "seized brake caliper piston",
        "category": "brakes",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "vapor lock",
        "canonical_term": "fuel system heat-induced vapor obstruction",
        "category": "fuel",
        "region": "southeast_us",
        "approved": True,
    },
    {
        "raw_term": "pinging",
        "canonical_term": "engine knock / pre-ignition",
        "category": "engine",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "dirty MAF",
        "canonical_term": "contaminated mass airflow sensor",
        "category": "engine",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "burned valve",
        "canonical_term": "exhaust valve thermal erosion",
        "category": "engine",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "cracked flex pipe",
        "canonical_term": "exhaust flex joint fracture",
        "category": "exhaust",
        "region": "midwest_us",
        "approved": True,
    },
    {
        "raw_term": "steering wander",
        "canonical_term": "front-end alignment drift / loose steering linkage",
        "category": "suspension",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "wet spark plugs",
        "canonical_term": "spark plugs fouled with fuel or oil",
        "category": "engine",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "leaking axle seal",
        "canonical_term": "axle shaft oil seal failure",
        "category": "drivetrain",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "slipping trans",
        "canonical_term": "transmission gear slip / clutch pack wear",
        "category": "transmission",
        "region": None,
        "approved": True,
    },
    {
        "raw_term": "clogged cat",
        "canonical_term": "catalytic converter flow restriction",
        "category": "exhaust",
        "region": None,
        "approved": True,
    },
]


# ── Seed function ──────────────────────────────────────────────────────────────


def seed_dialect_terms(db: Session) -> None:
    """Insert any seed terms not already present in ``dialect_terms``.

    Idempotent — terms are matched by ``raw_term``; existing rows are skipped.
    This function is intentionally side-effect-free when called multiple times.

    Args:
        db: Active SQLAlchemy session.
    """
    for entry in DIALECT_SEED:
        exists = (
            db.query(DialectTerm).filter(DialectTerm.raw_term == entry["raw_term"]).first()
        )
        if exists:
            continue
        db.add(
            DialectTerm(
                raw_term=entry["raw_term"],
                canonical_term=entry["canonical_term"],
                category=entry.get("category"),
                region=entry.get("region"),
                approved=entry.get("approved", False),
            )
        )
    db.commit()

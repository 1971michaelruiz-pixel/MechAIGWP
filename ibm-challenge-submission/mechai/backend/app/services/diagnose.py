"""Diagnosis engine — provider-agnostic symptom matching and GPT-4o synthesis."""

import json

from openai import OpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.models.vehicle import Vehicle
from app.services.provider_factory import get_provider

# Lazily instantiated OpenAI client
_openai_client: OpenAI | None = None


def _get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = OpenAI(api_key=settings.openai_api_key)
    return _openai_client


_SYSTEM_PROMPT = (
    "You are an expert automotive diagnostic assistant. "
    "Given a list of symptom tags and a set of relevant Technical Service Bulletins (TSBs) "
    "and community repair threads, synthesise up to 5 ranked repair solutions. "
    "Return ONLY a raw JSON array — no markdown fences, no explanation. "
    "Each element must have exactly these keys: "
    "  rank (integer 1-5), "
    "  description (plain English explanation of the repair), "
    "  source_citation (short string identifying the source TSB or thread), "
    "  labor_hours (number or null), "
    "  confidence_score (float 0.0-1.0). "
    "Order by descending confidence_score. "
    "If no relevant data is found, return an empty array: []"
)


def diagnose(
    make: str,
    model: str,
    year: int,
    symptom_tags: list[str],
    shop_id: str | None,
    db: Session,
) -> list[dict]:
    """Run the full diagnosis pipeline for a vehicle and symptom set.

    1. Resolves the appropriate ``RepairDataProvider`` for the shop.
    2. Fetches TSBs and community threads from the provider.
    3. Passes results + symptom tags to GPT-4o for ranked synthesis.

    Args:
        make: Vehicle manufacturer (e.g. ``"Toyota"``).
        model: Vehicle model (e.g. ``"Camry"``).
        year: Model year (e.g. ``2018``).
        symptom_tags: List of snake_case symptom tags from the service record.
        shop_id: Optional shop UUID string for provider resolution.
        db: Active SQLAlchemy session.

    Returns:
        A list of solution dicts, each with ``rank``, ``description``,
        ``source_citation``, ``labor_hours``, and ``confidence_score``.
        Returns ``[]`` on any error.
    """
    try:
        provider = get_provider(shop_id=shop_id, db=db)

        tsbs = provider.search_tsbs(make, model, year, symptom_tags)
        threads = provider.search_community_threads(make, model, year, symptom_tags)

        # Build concise context for GPT-4o
        tsb_lines = [
            f"- [{t.provider_source}] {t.title}: {t.diagnosis[:300]}"
            for t in tsbs[:8]
        ]
        thread_lines = [
            f"- [{th.provider_source}] {th.title}: {th.summary[:300]}"
            for th in threads[:4]
        ]

        context_block = "\n".join(tsb_lines + thread_lines) or "No repair data found."

        user_content = (
            f"Vehicle: {year} {make} {model}\n"
            f"Symptom tags: {', '.join(symptom_tags) or 'none provided'}\n\n"
            f"Available repair data:\n{context_block}"
        )

        client = _get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            max_tokens=1024,
            temperature=0,
        )

        raw = (response.choices[0].message.content or "").strip()
        solutions = json.loads(raw)
        if isinstance(solutions, list):
            return solutions
        return []

    except Exception:  # noqa: BLE001
        return []


def diagnose_by_vin(
    vin: str,
    symptom_tags: list[str],
    shop_id: str | None,
    db: Session,
) -> list[dict]:
    """Convenience wrapper that looks up make/model/year from the ``vehicles`` table.

    Args:
        vin: 17-character VIN to look up.
        symptom_tags: Symptom tags from the current service record.
        shop_id: Optional shop UUID string.
        db: Active SQLAlchemy session.

    Returns:
        Ranked solutions list, same shape as ``diagnose()``.  Returns ``[]``
        if the vehicle cannot be found or is missing make/model/year.
    """
    vehicle: Vehicle | None = (
        db.query(Vehicle).filter(Vehicle.vin == vin.upper()).first()
    )
    if not vehicle or not all([vehicle.make, vehicle.model, vehicle.year]):
        return []
    return diagnose(
        make=vehicle.make,  # type: ignore[arg-type]
        model=vehicle.model,  # type: ignore[arg-type]
        year=vehicle.year,  # type: ignore[arg-type]
        symptom_tags=symptom_tags,
        shop_id=shop_id,
        db=db,
    )

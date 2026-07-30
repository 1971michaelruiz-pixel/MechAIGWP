"""NHTSA public complaints endpoint adapter.

Maps the NHTSA vehicle-complaints API to the ``RepairDataProvider`` interface.
The endpoint used is the free, no-key-required complaints-by-vehicle resource
which serves as the closest public proxy for TSB-like data.

Reference: GET https://api.nhtsa.gov/complaints/complaintsByVehicle
            ?make=Toyota&model=Camry&modelYear=2018
"""

from __future__ import annotations

import httpx

from app.config import settings
from app.providers.base import CommunityThread, RepairDataProvider, TSBRecord

_MAX_RESULTS = 10


class NHTSAProvider(RepairDataProvider):
    """Fetches and normalises NHTSA public complaint data as TSB-like records.

    No API key is required.  All HTTP errors are swallowed — the provider
    returns an empty list rather than letting a network fault propagate to
    the caller.
    """

    def search_tsbs(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[TSBRecord]:
        """Query NHTSA complaints for the given vehicle and return up to 10 records.

        Each NHTSA complaint is mapped into a ``TSBRecord`` using the complaint
        ``summary`` field as both ``title`` and ``diagnosis``.

        Args:
            make: Vehicle manufacturer (e.g. ``"Toyota"``).
            model: Vehicle model (e.g. ``"Camry"``).
            year: Model year (e.g. ``2018``).
            symptom_tags: Symptom tags (not used for server-side filtering —
                NHTSA does not support tag-based queries).

        Returns:
            Up to ``_MAX_RESULTS`` ``TSBRecord`` objects, or ``[]`` on any error.
        """
        try:
            url = settings.nhtsa_tsb_api_url
            response = httpx.get(
                url,
                params={"make": make, "model": model, "modelYear": str(year)},
                timeout=10.0,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return []

        results: list[dict] = payload.get("results", [])
        records: list[TSBRecord] = []

        for entry in results[:_MAX_RESULTS]:
            summary = entry.get("summary") or entry.get("description") or ""
            component = entry.get("components") or entry.get("component") or ""
            title = (component[:128] if component else summary[:128]) or "NHTSA Complaint"

            records.append(
                TSBRecord(
                    tsb_number=str(entry.get("odiNumber") or entry.get("id") or ""),
                    title=title,
                    symptom_tags=[],
                    diagnosis=summary,
                    repair_procedure="Refer to manufacturer service bulletin",
                    labor_hours=None,
                    source_url=(
                        f"https://www.nhtsa.gov/vehicle/{make}/{model}/{year}/complaints"
                    ),
                    provider_source="nhtsa_complaints",
                )
            )

        return records

    def search_community_threads(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[CommunityThread]:
        """NHTSA does not provide community forum data — always returns ``[]``."""
        return []

    def get_labor_hours(self, tsb_id: str) -> float | None:
        """NHTSA does not publish labour estimates — always returns ``None``."""
        return None

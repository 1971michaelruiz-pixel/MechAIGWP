"""Generic configurable HTTP adapter for commercial repair data APIs.

Implement this provider to connect a commercial repair data API (e.g. ALLDATA,
Mitchell1, Identifix).  Configure per tenant in tenant_settings.

The provider expects the remote API to expose the following endpoints:
- ``GET {api_url}/tsbs?make=...&model=...&year=...``
- ``GET {api_url}/threads?make=...&model=...&year=...``
- ``GET {api_url}/labor?tsb_id=...``

All methods return empty results on any network or parse error so that a
misconfigured or unavailable third-party API never crashes the diagnosis flow.
"""

from __future__ import annotations

import httpx

from app.providers.base import CommunityThread, RepairDataProvider, TSBRecord


class GenericAPIProvider(RepairDataProvider):
    """Skeleton HTTP adapter for configurable third-party repair data APIs.

    Args:
        api_url: Base URL of the remote repair API (no trailing slash).
        api_key: Optional bearer token or API key sent as an
            ``Authorization: Bearer …`` header.
    """

    def __init__(self, api_url: str, api_key: str | None = None) -> None:
        self._api_url = api_url.rstrip("/")
        self._api_key = api_key

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        """Build request headers, injecting the API key when present."""
        headers: dict[str, str] = {"Accept": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    def _get(self, path: str, params: dict) -> list[dict]:
        """Perform a GET request and return the JSON body as a list.

        Returns ``[]`` on any network error, non-2xx status, or JSON parse
        failure so that the caller is never exposed to transport exceptions.
        """
        try:
            response = httpx.get(
                f"{self._api_url}{path}",
                params=params,
                headers=self._headers(),
                timeout=10.0,
            )
            response.raise_for_status()
            body = response.json()
            # Accept both a bare list and a {"results": [...]} envelope
            if isinstance(body, list):
                return body
            if isinstance(body, dict):
                return body.get("results", body.get("data", []))
            return []
        except Exception:
            return []

    # ── RepairDataProvider interface ──────────────────────────────────────────

    def search_tsbs(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[TSBRecord]:
        """Fetch TSBs from ``{api_url}/tsbs`` and map to ``TSBRecord`` objects.

        Args:
            make: Vehicle manufacturer.
            model: Vehicle model.
            year: Model year.
            symptom_tags: Symptom tags passed as a comma-separated ``tags``
                query param when non-empty.

        Returns:
            A (possibly empty) list of ``TSBRecord`` objects.
        """
        params: dict[str, str] = {"make": make, "model": model, "year": str(year)}
        if symptom_tags:
            params["tags"] = ",".join(symptom_tags)

        entries = self._get("/tsbs", params)
        records: list[TSBRecord] = []
        for entry in entries:
            records.append(
                TSBRecord(
                    tsb_number=entry.get("tsb_number") or entry.get("id"),
                    title=entry.get("title") or "",
                    symptom_tags=entry.get("symptom_tags") or [],
                    diagnosis=entry.get("diagnosis") or entry.get("description") or "",
                    repair_procedure=entry.get("repair_procedure") or "",
                    labor_hours=_safe_float(entry.get("labor_hours")),
                    source_url=entry.get("source_url") or entry.get("url"),
                    provider_source="generic_api",
                )
            )
        return records

    def search_community_threads(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[CommunityThread]:
        """Fetch threads from ``{api_url}/threads`` and map to ``CommunityThread`` objects.

        Args:
            make: Vehicle manufacturer.
            model: Vehicle model.
            year: Model year.
            symptom_tags: Symptom tags passed as a comma-separated ``tags``
                query param when non-empty.

        Returns:
            A (possibly empty) list of ``CommunityThread`` objects.
        """
        params: dict[str, str] = {"make": make, "model": model, "year": str(year)}
        if symptom_tags:
            params["tags"] = ",".join(symptom_tags)

        entries = self._get("/threads", params)
        threads: list[CommunityThread] = []
        for entry in entries:
            threads.append(
                CommunityThread(
                    title=entry.get("title") or "",
                    symptom_tags=entry.get("symptom_tags") or [],
                    summary=entry.get("summary") or entry.get("body") or "",
                    resolution=entry.get("resolution") or entry.get("answer"),
                    source_url=entry.get("source_url") or entry.get("url"),
                    provider_source="generic_api",
                )
            )
        return threads

    def get_labor_hours(self, tsb_id: str) -> float | None:
        """Fetch labour hours from ``{api_url}/labor?tsb_id=…``.

        Args:
            tsb_id: The TSB number or identifier to look up.

        Returns:
            Float hours, or ``None`` on any error or when the API returns no data.
        """
        entries = self._get("/labor", {"tsb_id": tsb_id})
        if entries and isinstance(entries, list):
            return _safe_float(entries[0].get("labor_hours"))
        if isinstance(entries, dict):
            return _safe_float(entries.get("labor_hours"))
        return None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _safe_float(value: object) -> float | None:
    """Coerce *value* to float, returning ``None`` on failure."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

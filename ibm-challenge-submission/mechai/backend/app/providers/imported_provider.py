"""Shop-uploaded repair data provider backed by the local database.

Queries the ``tsb_records`` and ``community_threads`` tables that shops
populate via CSV/JSON import (a future admin feature).  Filtering is done by
make, model, year overlap, and symptom tag overlap.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.community_thread import CommunityThread as CommunityThreadModel
from app.models.tsb_record import TSBRecord as TSBRecordModel
from app.providers.base import CommunityThread, RepairDataProvider, TSBRecord


class ImportedDataProvider(RepairDataProvider):
    """Reads TSB and community data previously imported into the database.

    Args:
        db: Active SQLAlchemy session.
        shop_id: Optional UUID string scoping results to a specific shop.
            If ``None``, all imported records are searched.
    """

    def __init__(self, db: Session, shop_id: str | None = None) -> None:
        self._db = db
        self._shop_id: uuid.UUID | None = None
        if shop_id:
            try:
                self._shop_id = uuid.UUID(shop_id)
            except ValueError:
                pass

    # ── TSBs ───────────────────────────────────────────────────────────────────

    def search_tsbs(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[TSBRecord]:
        """Query ``tsb_records`` filtering by make/model/year and tag overlap.

        A row is included when:
        - ``make`` matches (case-insensitive)
        - ``model`` matches (case-insensitive)
        - ``year`` falls within ``[year_min, year_max]``
        - At least one element of the row's ``symptom_tags`` JSON array appears
          in the supplied *symptom_tags* list (skipped when the list is empty)

        Args:
            make: Vehicle manufacturer.
            model: Vehicle model.
            year: Model year.
            symptom_tags: Tags to filter on; if empty all year/make/model
                matches are returned.

        Returns:
            A list of ``TSBRecord`` dataclass instances.
        """
        query = self._db.query(TSBRecordModel).filter(
            func.lower(TSBRecordModel.make) == make.lower(),
            func.lower(TSBRecordModel.model) == model.lower(),
            TSBRecordModel.year_min <= year,
            TSBRecordModel.year_max >= year,
        )

        if self._shop_id is not None:
            query = query.filter(TSBRecordModel.shop_id == self._shop_id)

        rows = query.all()

        # Client-side tag overlap filter (JSON array comparison)
        if symptom_tags:
            tag_set = set(symptom_tags)
            rows = [r for r in rows if _has_tag_overlap(r.symptom_tags, tag_set)]

        return [_model_to_tsb(r) for r in rows]

    # ── Community threads ─────────────────────────────────────────────────────

    def search_community_threads(
        self, make: str, model: str, year: int, symptom_tags: list[str]
    ) -> list[CommunityThread]:
        """Query ``community_threads`` filtering by make/model/year and tag overlap.

        Args:
            make: Vehicle manufacturer.
            model: Vehicle model.
            year: Model year.
            symptom_tags: Tags to filter on; if empty all make/model matches
                are returned.

        Returns:
            A list of ``CommunityThread`` dataclass instances.
        """
        query = self._db.query(CommunityThreadModel).filter(
            or_(CommunityThreadModel.make.is_(None), func.lower(CommunityThreadModel.make) == make.lower()),
            or_(CommunityThreadModel.model.is_(None), func.lower(CommunityThreadModel.model) == model.lower()),
            or_(CommunityThreadModel.year.is_(None), CommunityThreadModel.year == year),
        )

        if self._shop_id is not None:
            query = query.filter(CommunityThreadModel.shop_id == self._shop_id)

        rows = query.all()

        if symptom_tags:
            tag_set = set(symptom_tags)
            rows = [r for r in rows if _has_tag_overlap(r.symptom_tags, tag_set)]

        return [_model_to_thread(r) for r in rows]

    # ── Labour hours ──────────────────────────────────────────────────────────

    def get_labor_hours(self, tsb_id: str) -> float | None:
        """Return ``labor_hours`` for the ``tsb_records`` row matching *tsb_id*.

        Args:
            tsb_id: The ``tsb_number`` value to look up.

        Returns:
            Float labour hours, or ``None`` if the record does not exist or
            has no labour estimate.
        """
        row = (
            self._db.query(TSBRecordModel)
            .filter(TSBRecordModel.tsb_number == tsb_id)
            .first()
        )
        return row.labor_hours if row else None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _has_tag_overlap(stored_tags: list | None, query_tags: set[str]) -> bool:
    """Return ``True`` when *stored_tags* and *query_tags* share at least one element."""
    if not stored_tags:
        return False
    return bool(set(stored_tags) & query_tags)


def _model_to_tsb(row: TSBRecordModel) -> TSBRecord:
    """Convert a ``TSBRecord`` ORM row to the provider dataclass."""
    return TSBRecord(
        tsb_number=row.tsb_number,
        title=row.title,
        symptom_tags=row.symptom_tags or [],
        diagnosis=row.diagnosis,
        repair_procedure=row.repair_procedure,
        labor_hours=row.labor_hours,
        source_url=row.source_url,
        provider_source=row.provider_source,
    )


def _model_to_thread(row: CommunityThreadModel) -> CommunityThread:
    """Convert a ``CommunityThread`` ORM row to the provider dataclass."""
    return CommunityThread(
        title=row.title,
        symptom_tags=row.symptom_tags or [],
        summary=row.summary,
        resolution=row.resolution,
        source_url=row.source_url,
        provider_source=row.provider_source,
    )

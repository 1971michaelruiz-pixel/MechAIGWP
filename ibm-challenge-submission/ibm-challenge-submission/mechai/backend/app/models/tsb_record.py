"""SQLAlchemy model for imported / provider-sourced TSB records."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base

# pgvector is optional — import fails gracefully if the extension is not installed
try:
    from pgvector.sqlalchemy import Vector  # type: ignore[import]

    _VECTOR_TYPE = Vector(1536)
except Exception:  # noqa: BLE001
    _VECTOR_TYPE = None  # type: ignore[assignment]


class TSBRecord(Base):
    """A Technical Service Bulletin (or complaint-proxy) stored locally.

    Populated by ``NHTSAProvider`` sync jobs, CSV/JSON imports via
    ``ImportedDataProvider``, or any other ``RepairDataProvider`` that writes
    to the database.  The ``embedding`` column is reserved for future vector-
    similarity search and is nullable until that feature is activated.
    """

    __tablename__ = "tsb_records"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Multi-tenancy hook ────────────────────────────────────────────────────
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Vehicle scope ─────────────────────────────────────────────────────────
    make: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    year_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── TSB content ───────────────────────────────────────────────────────────
    tsb_number: Mapped[str | None] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    symptom_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    diagnosis: Mapped[str] = mapped_column(Text, nullable=False)
    repair_procedure: Mapped[str] = mapped_column(Text, nullable=False)
    labor_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # ── Provider metadata ─────────────────────────────────────────────────────
    provider_source: Mapped[str] = mapped_column(String(64), nullable=False)

    # ── Vector embedding (pgvector — populated in a future sub-task) ──────────
    # Requires the pgvector PostgreSQL extension and the pgvector Python package.
    if _VECTOR_TYPE is not None:
        embedding: Mapped[list | None] = mapped_column(_VECTOR_TYPE, nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

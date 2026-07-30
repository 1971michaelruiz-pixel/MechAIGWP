"""SQLAlchemy model for community repair discussion threads."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
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


class CommunityThread(Base):
    """A community forum thread or discussion post related to a repair topic.

    Populated by any ``RepairDataProvider`` that has access to community data.
    The ``embedding`` column is reserved for future vector-similarity search.
    """

    __tablename__ = "community_threads"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Multi-tenancy hook ────────────────────────────────────────────────────
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Vehicle scope (nullable — some threads apply to multiple vehicles) ─────
    make: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Thread content ────────────────────────────────────────────────────────
    symptom_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
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

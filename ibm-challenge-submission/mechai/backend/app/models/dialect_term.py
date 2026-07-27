"""SQLAlchemy model for approved and pending dialect term mappings."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class DialectTerm(Base):
    """Maps a raw mechanic slang term to its canonical automotive equivalent.

    Terms can be global (``shop_id`` is ``NULL``) or scoped to a single shop.
    Only rows with ``approved=True`` are injected into Whisper prompts and used
    during transcript normalization.  ``usage_count`` increments every time the
    term is matched during ``normalize_transcript``.
    """

    __tablename__ = "dialect_terms"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Multi-tenancy (NULL = global term shared across all shops) ─────────────
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Term mapping ──────────────────────────────────────────────────────────
    raw_term: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    canonical_term: Mapped[str] = mapped_column(String(128), nullable=False)

    # ── Classification ────────────────────────────────────────────────────────
    # e.g. "brakes", "engine", "suspension", "electrical", "cooling"
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # e.g. "southeast_us", "midwest_us", "southwest_us", "northeast_us"
    region: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── Workflow ──────────────────────────────────────────────────────────────
    approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Indexes ───────────────────────────────────────────────────────────────
    __table_args__ = (
        Index("ix_dialect_terms_shop_approved", "shop_id", "approved"),
    )

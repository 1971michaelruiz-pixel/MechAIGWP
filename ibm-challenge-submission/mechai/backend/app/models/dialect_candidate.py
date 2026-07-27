"""SQLAlchemy model for unrecognized dialect terms flagged for manager review."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class DialectCandidate(Base):
    """Captures unrecognized mechanic slang encountered during transcription.

    When ``flag_unknown_terms`` detects an all-caps token of 4+ characters in a
    transcript that is not already in ``dialect_terms``, it upserts a row here.
    Shop managers review these rows in the ``DialectAdminPanel`` and can promote
    them to ``dialect_terms`` or dismiss them.

    ``occurrence_count`` increments each time the same ``raw_term`` is seen for
    the same shop, giving managers a signal of how frequently the term appears.
    """

    __tablename__ = "dialect_candidates"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Multi-tenancy ─────────────────────────────────────────────────────────
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Candidate payload ─────────────────────────────────────────────────────
    raw_term: Mapped[str] = mapped_column(String(128), nullable=False)

    # Short excerpt from the transcript that contained the term
    context_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Counters ──────────────────────────────────────────────────────────────
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # ── Audit ─────────────────────────────────────────────────────────────────
    flagged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

"""SQLAlchemy model for a unified mechanic session (state machine)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base

# Valid session states in linear order
SESSION_STATES: list[str] = [
    "listening",
    "vin_capture",
    "customer_assign",
    "symptom_intake",
    "inspection_intake",
    "diagnosing",
    "complete",
]


class MechSession(Base):
    """A unified mechanic session that persists state-machine progress.

    Created at the moment a mechanic opens the workflow UI and advanced through
    states as each intake phase is completed.  All foreign-key fields start as
    ``None`` and are filled in as the session progresses.

    ``transcript_ids`` is a JSON array of ``transcription_sessions.id`` UUIDs
    accumulated during the session.

    ``shop_id`` and ``mechanic_id`` are nullable placeholders populated once
    the multi-tenancy auth layer is wired in.
    """

    __tablename__ = "sessions"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Multi-tenancy hooks ───────────────────────────────────────────────────
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    mechanic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Relationships (filled in as session advances) ─────────────────────────
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.id", ondelete="SET NULL"),
        nullable=True,
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    service_record_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("service_records.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── State machine ─────────────────────────────────────────────────────────
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="listening")

    # ── Collected transcript session IDs ──────────────────────────────────────
    transcript_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

"""SQLAlchemy model for service visit records."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class ServiceRecord(Base):
    """A single workshop visit recorded against a vehicle.

    ``presented_symptoms`` holds the raw transcript from phase 1 (what the
    customer described), ``inspection_findings`` holds the raw transcript from
    phase 2 (what the mechanic found on the lift).  ``symptom_tags`` is a JSON
    array of short snake_case tags extracted by GPT-4o (e.g.
    ``["brake_squeal", "fluid_leak"]``).

    ``shop_id`` and ``mechanic_id`` are nullable placeholders that will be
    populated once the multi-tenancy auth layer is wired in.
    """

    __tablename__ = "service_records"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Relationships ─────────────────────────────────────────────────────────
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Multi-tenancy / auth hooks ─────────────────────────────────────────────
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    mechanic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Visit timestamp ────────────────────────────────────────────────────────
    visit_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── Voice capture phases ──────────────────────────────────────────────────
    presented_symptoms: Mapped[str | None] = mapped_column(Text, nullable=True)
    inspection_findings: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── LLM-extracted tags ────────────────────────────────────────────────────
    symptom_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)

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

    __table_args__ = (Index("ix_service_records_vehicle_visit", "vehicle_id", "visit_date"),)

"""SQLAlchemy model for decoded vehicle profiles."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class Vehicle(Base):
    """Stores a decoded vehicle profile keyed on VIN.

    Populated by ``POST /api/vehicles`` after a mechanic speaks or manually enters
    a VIN and confirms the NHTSA-decoded details.  The ``vin`` column carries a
    unique constraint so that repeated scans of the same vehicle upsert rather than
    create duplicate rows.

    ``shop_id`` is nullable for now and will be populated once the multi-tenancy
    auth layer (Sub-Task 4) is wired in.
    """

    __tablename__ = "vehicles"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Multi-tenancy hook (populated by auth middleware later) ───────────────
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Vehicle identity (VIN is the natural key) ─────────────────────────────
    vin: Mapped[str] = mapped_column(String(17), unique=True, nullable=False, index=True)

    # ── Decoded vehicle attributes ────────────────────────────────────────────
    make: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model: Mapped[str | None] = mapped_column(String(64), nullable=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    trim: Mapped[str | None] = mapped_column(String(128), nullable=True)
    engine: Mapped[str | None] = mapped_column(String(128), nullable=True)
    body_style: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # ── Raw NHTSA payload (kept for debugging / future field extraction) ──────
    raw_nhtsa_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)

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

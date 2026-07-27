"""SQLAlchemy model for the customer–vehicle ownership join table."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class CustomerVehicle(Base):
    """Records that a customer owns (or owned) a specific vehicle.

    A single vehicle can have multiple ``CustomerVehicle`` rows over time, but
    only one row per vehicle should carry ``is_current_owner=True`` at any
    moment.  The assignment endpoint enforces this invariant by flipping all
    existing rows to ``False`` before inserting the new one.
    """

    __tablename__ = "customer_vehicles"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Foreign keys ──────────────────────────────────────────────────────────
    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id"),
        nullable=False,
        index=True,
    )
    vehicle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.id"),
        nullable=False,
        index=True,
    )

    # ── Assignment metadata ───────────────────────────────────────────────────
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    is_current_owner: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

"""SQLAlchemy model for customer records."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class Customer(Base):
    """A customer associated with one or more vehicles at a shop.

    ``shop_id`` is nullable and will be populated once the multi-tenancy auth
    layer is wired in.  Name and optional contact fields are stored directly on
    the record; no separate contact entity is needed at this stage.
    """

    __tablename__ = "customers"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Multi-tenancy hook ────────────────────────────────────────────────────
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    first_name: Mapped[str] = mapped_column(String(64), nullable=False)
    last_name: Mapped[str] = mapped_column(String(64), nullable=False)

    # ── Contact ───────────────────────────────────────────────────────────────
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(256), nullable=True)

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

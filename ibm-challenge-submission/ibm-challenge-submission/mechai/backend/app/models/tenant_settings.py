"""SQLAlchemy model for per-tenant platform configuration."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class TenantSettings(Base):
    """One row per shop holding runtime configuration for that tenant.

    ``repair_data_provider`` controls which ``RepairDataProvider`` implementation
    is used during diagnosis:
      - ``"nhtsa"``       → ``NHTSAProvider`` (default, free, no config needed)
      - ``"imported"``    → ``ImportedDataProvider`` (shop-uploaded CSV/JSON data)
      - ``"generic_api"`` → ``GenericAPIProvider`` (requires ``generic_api_url``)

    Additional provider types (e.g. ``"alldata"``, ``"mitchell1"``) can be added
    as separate packages that implement ``RepairDataProvider`` — no core changes
    are required.
    """

    __tablename__ = "tenant_settings"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Shop identity (one settings row per shop) ─────────────────────────────
    shop_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, nullable=False, index=True
    )

    # ── Repair data provider selection ───────────────────────────────────────
    repair_data_provider: Mapped[str] = mapped_column(
        String(64), nullable=False, default="nhtsa"
    )

    # ── GenericAPIProvider config (used when repair_data_provider="generic_api") ─
    generic_api_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    generic_api_key: Mapped[str | None] = mapped_column(String(256), nullable=True)

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

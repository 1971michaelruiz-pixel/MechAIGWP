"""SQLAlchemy model for transcription sessions."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db import Base


class TranscriptionSession(Base):
    """Stores a single voice-capture → Whisper transcription event.

    Each row represents one push-to-talk recording by a mechanic.
    ``shop_id`` is nullable for now and will be populated once the multi-tenancy
    auth layer (Sub-Task 4) is wired in.
    """

    __tablename__ = "transcription_sessions"

    # ── Primary key ───────────────────────────────────────────────────────────
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ── Multi-tenancy hook (populated by auth middleware later) ───────────────
    shop_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # ── Session identity ──────────────────────────────────────────────────────
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # ── Transcription payload ─────────────────────────────────────────────────
    transcript: Mapped[str] = mapped_column(Text, nullable=False)

    # Whisper basic transcriptions endpoint does not return per-utterance
    # confidence; kept nullable for future model upgrades that do.
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Filename or storage path of the original audio upload
    audio_ref: Mapped[str] = mapped_column(String(512), nullable=False)

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

"""POST /api/transcribe — receive audio, call Whisper, persist and return transcript."""

# Target: transcript returned within 3s for a 30-second clip

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models.transcription import TranscriptionSession
from app.services.dialect import flag_unknown_terms, get_whisper_prompt, normalize_transcript

router = APIRouter(prefix="/api", tags=["transcribe"])

# Lazily instantiated so tests can patch settings before import
_openai_client: AsyncOpenAI | None = None


def _get_openai_client() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _openai_client


# ── Response schema ────────────────────────────────────────────────────────────


class TranscribeResponse(BaseModel):
    """Response payload for a successful transcription."""

    session_id: str
    transcript: str
    confidence: float | None


# ── Route ──────────────────────────────────────────────────────────────────────


@router.post(
    "/transcribe",
    response_model=TranscribeResponse,
    summary="Transcribe an audio clip via OpenAI Whisper",
    status_code=status.HTTP_200_OK,
)
async def transcribe_audio(
    audio: UploadFile,
    db: Session = Depends(get_db),
) -> TranscribeResponse:
    """Accept a multipart audio upload, transcribe it, and return the text.

    Args:
        audio: The uploaded audio file (e.g. webm, mp4, wav, m4a).
        db: Injected SQLAlchemy session.

    Returns:
        ``TranscribeResponse`` containing ``session_id``, ``transcript``, and
        ``confidence`` (always ``None`` for the standard Whisper endpoint).

    Raises:
        HTTPException 422: If no file is provided.
        HTTPException 502: If the Whisper API call fails.
    """
    if not audio.filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No audio file provided.",
        )

    audio_bytes = await audio.read()

    # ── Build dialect vocabulary hint for Whisper ──────────────────────────────
    whisper_prompt = get_whisper_prompt(shop_id=None, db=db)

    try:
        client = _get_openai_client()
        # Pass a (filename, bytes, content_type) tuple — the SDK accepts this form
        create_kwargs: dict = {
            "model": settings.whisper_model,
            "file": (audio.filename, audio_bytes, audio.content_type or "audio/webm"),
        }
        if whisper_prompt:
            create_kwargs["initial_prompt"] = whisper_prompt
        result = await client.audio.transcriptions.create(**create_kwargs)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Whisper API error: {exc}",
        ) from exc

    # ── Dialect normalization pipeline ────────────────────────────────────────
    normalized_text = normalize_transcript(result.text, shop_id=None, db=db)

    try:
        flag_unknown_terms(normalized_text, shop_id=None, db=db)
    except Exception:  # noqa: BLE001
        pass  # Fire-and-forget — never block the response

    session_id = uuid.uuid4()

    record = TranscriptionSession(
        session_id=session_id,
        transcript=normalized_text,
        confidence=None,  # Whisper basic endpoint does not return confidence scores
        audio_ref=audio.filename,
    )
    db.add(record)
    db.commit()

    return TranscribeResponse(
        session_id=str(session_id),
        transcript=normalized_text,
        confidence=None,
    )

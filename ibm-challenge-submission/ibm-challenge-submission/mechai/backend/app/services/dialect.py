"""Dialect service — Whisper prompt injection, transcript normalization, and candidate flagging."""

# Pipeline applied to every transcription:
#   1. get_whisper_prompt   → inject approved slang into Whisper initial_prompt
#   2. normalize_transcript → replace raw terms with canonical equivalents
#   3. flag_unknown_terms   → upsert all-caps abbreviations into dialect_candidates

import re
import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.dialect_candidate import DialectCandidate
from app.models.dialect_term import DialectTerm

# ── Helpers ────────────────────────────────────────────────────────────────────

_ALL_CAPS_TOKEN = re.compile(r"\b([A-Z]{4,})\b")


def _approved_terms_query(shop_id: str | None, db: Session):
    """Return a SQLAlchemy query for all approved terms visible to *shop_id*.

    Includes both global terms (``shop_id IS NULL``) and terms specific to the
    given shop.  When *shop_id* is ``None``, only global terms are returned.

    Args:
        shop_id: Optional UUID string of the requesting shop.
        db: Active SQLAlchemy session.

    Returns:
        A query object yielding ``DialectTerm`` rows.
    """
    q = db.query(DialectTerm).filter(DialectTerm.approved.is_(True))
    if shop_id:
        q = q.filter(
            or_(DialectTerm.shop_id.is_(None), DialectTerm.shop_id == uuid.UUID(shop_id))
        )
    else:
        q = q.filter(DialectTerm.shop_id.is_(None))
    return q


# ── Public API ─────────────────────────────────────────────────────────────────


def get_whisper_prompt(shop_id: str | None, db: Session) -> str:
    """Build a comma-separated vocabulary hint string for the Whisper ``initial_prompt``.

    Whisper uses the ``initial_prompt`` as prior context, which nudges the model
    to recognise domain-specific vocabulary.  Passing approved dialect raw terms
    here significantly improves transcription accuracy for shop-specific slang.

    Args:
        shop_id: Optional shop UUID string; global terms are always included.
        db: Active SQLAlchemy session.

    Returns:
        A comma-separated string of ``raw_term`` values (e.g.
        ``"warped rotors, shot struts, death wobble"``), or an empty string if
        no approved terms exist.
    """
    terms = _approved_terms_query(shop_id, db).all()
    if not terms:
        return ""
    return ", ".join(t.raw_term for t in terms)


def normalize_transcript(transcript: str, shop_id: str | None, db: Session) -> str:
    """Replace raw dialect terms in *transcript* with their canonical equivalents.

    Performs whole-word, case-insensitive substitution so that partial matches
    inside longer tokens are not replaced.  Each matched term has its
    ``usage_count`` incremented and the session is committed before returning.

    Args:
        transcript: The raw Whisper transcript text.
        shop_id: Optional shop UUID string; global terms are always included.
        db: Active SQLAlchemy session.

    Returns:
        The transcript with all matched raw terms replaced by their canonical
        counterparts.
    """
    terms = _approved_terms_query(shop_id, db).all()
    if not terms:
        return transcript

    normalized = transcript
    matched_ids: list[uuid.UUID] = []

    for term in terms:
        pattern = r"\b" + re.escape(term.raw_term) + r"\b"
        new_text, count = re.subn(pattern, term.canonical_term, normalized, flags=re.IGNORECASE)
        if count > 0:
            normalized = new_text
            matched_ids.append(term.id)

    if matched_ids:
        db.query(DialectTerm).filter(DialectTerm.id.in_(matched_ids)).update(
            {DialectTerm.usage_count: DialectTerm.usage_count + 1},
            synchronize_session=False,
        )
        db.commit()

    return normalized


def flag_unknown_terms(transcript: str, shop_id: str | None, db: Session) -> None:
    """Upsert all-caps tokens (4+ chars) from *transcript* into ``dialect_candidates``.

    Uses a simple heuristic: mechanics often shout abbreviations or brand names
    in all-caps (e.g. ``TPMS``, ``EVAP``, ``ABS``).  These tokens are upserted
    into ``dialect_candidates`` so shop managers can review and promote them to
    approved ``dialect_terms``.

    This function is intentionally fire-and-forget — all exceptions are caught
    and silently ignored so that a flagging failure never disrupts transcription.

    Args:
        transcript: The normalized transcript text.
        shop_id: Optional shop UUID string; candidates are stored with this scope.
        db: Active SQLAlchemy session.
    """
    try:
        tokens = _ALL_CAPS_TOKEN.findall(transcript)
        if not tokens:
            return

        shop_uuid = uuid.UUID(shop_id) if shop_id else None

        for token in set(tokens):
            # Find a short context window around the token for the snippet
            match = re.search(r".{0,30}" + re.escape(token) + r".{0,30}", transcript)
            snippet = match.group(0).strip() if match else None

            existing = (
                db.query(DialectCandidate)
                .filter(
                    DialectCandidate.raw_term == token,
                    DialectCandidate.shop_id == shop_uuid,
                )
                .first()
            )

            if existing:
                existing.occurrence_count += 1
            else:
                db.add(
                    DialectCandidate(
                        shop_id=shop_uuid,
                        raw_term=token,
                        context_snippet=snippet,
                    )
                )

        db.commit()
    except Exception:  # noqa: BLE001
        # Best-effort only — never propagate flagging errors to the caller
        db.rollback()

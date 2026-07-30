"""Dialect admin endpoints: term management and candidate review."""

# GET    /api/dialect/terms                    — list terms
# POST   /api/dialect/terms                    — create term (unapproved)
# PATCH  /api/dialect/terms/{term_id}/approve  — approve a term
# GET    /api/dialect/candidates               — list flagged candidates
# DELETE /api/dialect/candidates/{candidate_id} — dismiss a candidate
# GET    /api/dialect/seed                     — dev-only seed endpoint

import uuid as _uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import TokenPayload, get_current_user, require_role
from app.config import settings
from app.db import get_db
from app.models.dialect_candidate import DialectCandidate
from app.models.dialect_term import DialectTerm
from app.seeds.dialect_seed import seed_dialect_terms

router = APIRouter(prefix="/api/dialect", tags=["dialect"])


# ── Response / Request schemas ─────────────────────────────────────────────────


class DialectTermSchema(BaseModel):
    """Public representation of a ``DialectTerm`` row."""

    id: str
    shop_id: str | None
    raw_term: str
    canonical_term: str
    category: str | None
    region: str | None
    approved: bool
    usage_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class CreateTermRequest(BaseModel):
    """Body for POST /api/dialect/terms."""

    raw_term: str
    canonical_term: str
    category: str | None = None
    region: str | None = None
    shop_id: str | None = None


class DialectCandidateSchema(BaseModel):
    """Public representation of a ``DialectCandidate`` row."""

    id: str
    shop_id: str | None
    raw_term: str
    context_snippet: str | None
    occurrence_count: int
    flagged_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ────────────────────────────────────────────────────────────────────


def _term_to_schema(row: DialectTerm) -> DialectTermSchema:
    """Convert a ``DialectTerm`` ORM row to ``DialectTermSchema``."""
    return DialectTermSchema(
        id=str(row.id),
        shop_id=str(row.shop_id) if row.shop_id else None,
        raw_term=row.raw_term,
        canonical_term=row.canonical_term,
        category=row.category,
        region=row.region,
        approved=row.approved,
        usage_count=row.usage_count,
        created_at=row.created_at,
    )


def _candidate_to_schema(row: DialectCandidate) -> DialectCandidateSchema:
    """Convert a ``DialectCandidate`` ORM row to ``DialectCandidateSchema``."""
    return DialectCandidateSchema(
        id=str(row.id),
        shop_id=str(row.shop_id) if row.shop_id else None,
        raw_term=row.raw_term,
        context_snippet=row.context_snippet,
        occurrence_count=row.occurrence_count,
        flagged_at=row.flagged_at,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.get(
    "/terms",
    response_model=list[DialectTermSchema],
    summary="List dialect terms",
    status_code=status.HTTP_200_OK,
)
def list_terms(
    approved: bool | None = Query(None, description="Filter by approval status."),
    shop_id: str | None = Query(None, description="Filter by shop UUID; includes global terms."),
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> list[DialectTermSchema]:
    """Return dialect terms ordered by ``usage_count`` descending.

    When *shop_id* is provided, the results include both global terms
    (``shop_id IS NULL``) and terms belonging to that specific shop.

    Args:
        approved: Optional boolean filter on the ``approved`` column.
        shop_id: Optional shop UUID string to scope the results.
        db: Injected SQLAlchemy session.

    Returns:
        Ordered list of ``DialectTermSchema`` objects.
    """
    q = db.query(DialectTerm)

    if approved is not None:
        q = q.filter(DialectTerm.approved.is_(approved))

    if shop_id:
        from sqlalchemy import or_

        q = q.filter(
            or_(DialectTerm.shop_id.is_(None), DialectTerm.shop_id == _uuid.UUID(shop_id))
        )

    rows = q.order_by(DialectTerm.usage_count.desc()).all()
    return [_term_to_schema(r) for r in rows]


@router.post(
    "/terms",
    response_model=DialectTermSchema,
    summary="Create a new dialect term (unapproved)",
    status_code=status.HTTP_201_CREATED,
)
def create_term(
    body: CreateTermRequest,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> DialectTermSchema:
    """Insert a new dialect term with ``approved=False``.

    The term must be reviewed and approved via the
    ``PATCH /api/dialect/terms/{id}/approve`` endpoint before it is used in
    transcription or normalization.

    Args:
        body: Required ``raw_term`` and ``canonical_term``; optional
            ``category``, ``region``, ``shop_id``.
        db: Injected SQLAlchemy session.

    Returns:
        The newly created ``DialectTermSchema``.
    """
    shop_uuid = _uuid.UUID(body.shop_id) if body.shop_id else None

    row = DialectTerm(
        shop_id=shop_uuid,
        raw_term=body.raw_term,
        canonical_term=body.canonical_term,
        category=body.category,
        region=body.region,
        approved=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _term_to_schema(row)


@router.patch(
    "/terms/{term_id}/approve",
    response_model=DialectTermSchema,
    summary="Approve a dialect term",
    status_code=status.HTTP_200_OK,
)
def approve_term(
    term_id: str,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(require_role("admin")),
) -> DialectTermSchema:
    """Set ``approved=True`` on the specified dialect term.

    Once approved, the term will be included in Whisper ``initial_prompt``
    injections and transcript normalization passes.

    Args:
        term_id: UUID of the ``DialectTerm`` to approve.
        db: Injected SQLAlchemy session.

    Returns:
        The updated ``DialectTermSchema``.

    Raises:
        HTTPException 404: If no term with the given ID exists.
    """
    row = db.get(DialectTerm, _uuid.UUID(term_id))
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dialect term '{term_id}' not found.",
        )
    row.approved = True
    db.commit()
    db.refresh(row)
    return _term_to_schema(row)


@router.get(
    "/candidates",
    response_model=list[DialectCandidateSchema],
    summary="List flagged dialect candidates",
    status_code=status.HTTP_200_OK,
)
def list_candidates(
    shop_id: str | None = Query(None, description="Filter by shop UUID."),
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> list[DialectCandidateSchema]:
    """Return flagged candidates ordered by ``occurrence_count`` descending.

    Args:
        shop_id: Optional shop UUID string to scope the results.
        db: Injected SQLAlchemy session.

    Returns:
        Ordered list of ``DialectCandidateSchema`` objects.
    """
    q = db.query(DialectCandidate)
    if shop_id:
        q = q.filter(DialectCandidate.shop_id == _uuid.UUID(shop_id))
    rows = q.order_by(DialectCandidate.occurrence_count.desc()).all()
    return [_candidate_to_schema(r) for r in rows]


@router.delete(
    "/candidates/{candidate_id}",
    summary="Dismiss a flagged dialect candidate",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_candidate(
    candidate_id: str,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(require_role("admin")),
) -> None:
    """Delete a ``DialectCandidate`` row (manager dismissal).

    Args:
        candidate_id: UUID of the ``DialectCandidate`` to delete.
        db: Injected SQLAlchemy session.

    Raises:
        HTTPException 404: If no candidate with the given ID exists.
    """
    row = db.get(DialectCandidate, _uuid.UUID(candidate_id))
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dialect candidate '{candidate_id}' not found.",
        )
    db.delete(row)
    db.commit()


@router.get(
    "/seed",
    summary="Seed initial dialect terms (dev only)",
    status_code=status.HTTP_200_OK,
)
def seed_terms(db: Session = Depends(get_db)) -> dict:
    """Insert the built-in automotive dialect seed corpus (development only).

    This endpoint is disabled in production.  It is a convenience helper for
    local development and demo environments — not a database migration.

    Args:
        db: Injected SQLAlchemy session.

    Returns:
        A dict with ``{ "seeded": true }`` on success.

    Raises:
        HTTPException 403: In production environments.
    """
    if settings.app_env == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seed endpoint is disabled in production.",
        )
    seed_dialect_terms(db)
    return {"seeded": True}

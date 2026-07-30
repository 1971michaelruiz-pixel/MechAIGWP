"""Sessions router: CRUD + summary + PDF export for MechSession records."""

# POST   /api/sessions                    — create new session
# GET    /api/sessions/{session_id}       — fetch session
# PATCH  /api/sessions/{session_id}       — advance state
# GET    /api/sessions/{session_id}/summary — full summary dict
# GET    /api/sessions/{session_id}/pdf   — PDF export (application/pdf)

import io
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib import colors
from sqlalchemy.orm import Session

from app.auth import TokenPayload, get_current_user
from app.db import get_db
from app.models.session import SESSION_STATES
from app.services.session_orchestrator import (
    advance_state,
    build_summary,
    create_session,
    get_session,
)

router = APIRouter(prefix="/api", tags=["sessions"])


# ── Schemas ────────────────────────────────────────────────────────────────────


class CreateSessionRequest(BaseModel):
    """Body for POST /api/sessions."""

    shop_id: str | None = None
    mechanic_id: str | None = None


class AdvanceSessionRequest(BaseModel):
    """Body for PATCH /api/sessions/{session_id}."""

    state: str
    vehicle_id: str | None = None
    customer_id: str | None = None
    service_record_id: str | None = None


class SessionResponse(BaseModel):
    """Lightweight session representation returned by create / get / advance."""

    id: str
    state: str
    shop_id: str | None
    mechanic_id: str | None
    vehicle_id: str | None
    customer_id: str | None
    service_record_id: str | None
    transcript_ids: list[Any] | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ────────────────────────────────────────────────────────────────────


def _to_response(row: Any) -> SessionResponse:
    """Convert a ``MechSession`` ORM row to ``SessionResponse``."""
    return SessionResponse(
        id=str(row.id),
        state=row.state,
        shop_id=str(row.shop_id) if row.shop_id else None,
        mechanic_id=str(row.mechanic_id) if row.mechanic_id else None,
        vehicle_id=str(row.vehicle_id) if row.vehicle_id else None,
        customer_id=str(row.customer_id) if row.customer_id else None,
        service_record_id=str(row.service_record_id) if row.service_record_id else None,
        transcript_ids=row.transcript_ids,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _build_pdf(summary: dict) -> bytes:
    """Render a session summary as a PDF document and return the raw bytes.

    Uses ReportLab ``SimpleDocTemplate`` with standard ``Paragraph`` and
    ``Table`` elements — no images, no external fonts.

    Args:
        summary: The summary dict produced by ``build_summary()``.

    Returns:
        Raw PDF bytes suitable for streaming as ``application/pdf``.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    story: list[Any] = []

    def _h1(text: str) -> Paragraph:
        return Paragraph(f"<b><font size='18'>{text}</font></b>", styles["Normal"])

    def _h2(text: str) -> Paragraph:
        return Paragraph(f"<b><font size='13'>{text}</font></b>", styles["Normal"])

    def _body(text: str) -> Paragraph:
        return Paragraph(text, styles["Normal"])

    def _muted(text: str) -> Paragraph:
        return Paragraph(f"<font color='#57606a' size='9'>{text}</font>", styles["Normal"])

    def _spacer(h: int = 6) -> Spacer:
        return Spacer(1, h * mm)

    # ── Header ────────────────────────────────────────────────────────────────
    story.append(_h1("MechAI — Session Report"))
    story.append(_spacer(2))

    sess = summary.get("session", {})
    story.append(_muted(f"Session ID: {sess.get('id', '—')}"))
    story.append(_muted(f"Created: {sess.get('created_at', '—')}"))
    story.append(_muted(f"State: {sess.get('state', '—')}"))
    story.append(_spacer(8))

    # ── Vehicle ───────────────────────────────────────────────────────────────
    story.append(_h2("Vehicle"))
    story.append(_spacer(2))
    vehicle = summary.get("vehicle") or {}
    if vehicle:
        tbl_data = [
            ["VIN", vehicle.get("vin", "—")],
            ["Make", vehicle.get("make", "—")],
            ["Model", vehicle.get("model", "—")],
            ["Year", str(vehicle.get("year", "—"))],
            ["Trim", vehicle.get("trim") or "—"],
            ["Engine", vehicle.get("engine") or "—"],
        ]
        tbl = Table(tbl_data, colWidths=[40 * mm, 120 * mm])
        tbl.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#57606a")),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
                    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f7f8fa")]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(tbl)
    else:
        story.append(_muted("No vehicle recorded."))
    story.append(_spacer(8))

    # ── Customer ──────────────────────────────────────────────────────────────
    story.append(_h2("Customer"))
    story.append(_spacer(2))
    customer = summary.get("customer") or {}
    if customer:
        name = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
        tbl_data = [
            ["Name", name],
            ["Phone", customer.get("phone") or "—"],
            ["Email", customer.get("email") or "—"],
        ]
        tbl = Table(tbl_data, colWidths=[40 * mm, 120 * mm])
        tbl.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#57606a")),
                    ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
                    ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f7f8fa")]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(tbl)
    else:
        story.append(_muted("No customer assigned."))
    story.append(_spacer(8))

    # ── Service Record ────────────────────────────────────────────────────────
    story.append(_h2("Service Record"))
    story.append(_spacer(2))
    svc = summary.get("service_record") or {}
    if svc:
        story.append(_muted("Presented symptoms:"))
        story.append(_body(svc.get("presented_symptoms") or "—"))
        story.append(_spacer(3))
        story.append(_muted("Inspection findings:"))
        story.append(_body(svc.get("inspection_findings") or "—"))
        story.append(_spacer(3))
        tags: list[str] = svc.get("symptom_tags") or []
        story.append(_muted(f"Symptom tags: {', '.join(tags) if tags else '—'}"))
    else:
        story.append(_muted("No service record saved."))
    story.append(_spacer(8))

    # ── Diagnosis ─────────────────────────────────────────────────────────────
    diagnosis: list[dict] = summary.get("diagnosis") or []
    story.append(_h2("Diagnosis Solutions"))
    story.append(_spacer(2))
    if diagnosis:
        for sol in diagnosis:
            story.append(
                _body(
                    f"<b>{sol.get('rank', '?')}.</b> {sol.get('description', '—')} "
                    f"<font color='#57606a'>[{sol.get('source_citation', '—')}]</font>"
                )
            )
            if sol.get("labor_hours") is not None:
                story.append(_muted(f"Labor: {sol['labor_hours']} hrs  |  "
                                    f"Confidence: {sol.get('confidence_score', 0):.0%}"))
            story.append(_spacer(3))
    else:
        story.append(_muted("Diagnosis not yet run or no solutions found."))

    doc.build(story)
    return buf.getvalue()


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.post(
    "/sessions",
    response_model=SessionResponse,
    summary="Create a new mechanic session",
    status_code=status.HTTP_201_CREATED,
)
def create_session_route(
    body: CreateSessionRequest,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> SessionResponse:
    """Create a new ``MechSession`` in the ``"listening"`` state.

    Args:
        body: Optional ``shop_id`` and ``mechanic_id``.
        db: Injected SQLAlchemy session.

    Returns:
        The new session as a ``SessionResponse``.
    """
    row = create_session(
        shop_id=body.shop_id,
        mechanic_id=body.mechanic_id,
        db=db,
    )
    return _to_response(row)


@router.get(
    "/sessions/{session_id}",
    response_model=SessionResponse,
    summary="Retrieve a session by ID",
    status_code=status.HTTP_200_OK,
)
def get_session_route(
    session_id: str,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> SessionResponse:
    """Fetch the current state of a ``MechSession``.

    Args:
        session_id: UUID string of the session.
        db: Injected SQLAlchemy session.

    Returns:
        The ``SessionResponse`` for the requested session.

    Raises:
        HTTPException 404: Session not found.
    """
    from fastapi import HTTPException  # local to avoid circular import risk

    row = get_session(session_id, db)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )
    return _to_response(row)


@router.patch(
    "/sessions/{session_id}",
    response_model=SessionResponse,
    summary="Advance session state",
    status_code=status.HTTP_200_OK,
)
def advance_session_route(
    session_id: str,
    body: AdvanceSessionRequest,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> SessionResponse:
    """Advance the session to the next state and optionally set FK fields.

    Only linear forward transitions are accepted.

    Args:
        session_id: UUID string of the session to advance.
        body: New ``state`` and optional FK overrides.
        db: Injected SQLAlchemy session.

    Returns:
        The updated ``SessionResponse``.

    Raises:
        HTTPException 404: Session not found.
        HTTPException 422: Illegal state transition.
    """
    row = advance_state(
        session_id=session_id,
        to_state=body.state,
        db=db,
        vehicle_id=body.vehicle_id,
        customer_id=body.customer_id,
        service_record_id=body.service_record_id,
    )
    return _to_response(row)


@router.get(
    "/sessions/{session_id}/summary",
    summary="Full session summary (vehicle + customer + service record + diagnosis)",
    status_code=status.HTTP_200_OK,
)
def session_summary_route(
    session_id: str,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> dict:
    """Return a full JSON summary of the session.

    Args:
        session_id: UUID string of the session.
        db: Injected SQLAlchemy session.

    Returns:
        Summary dict with ``session``, ``vehicle``, ``customer``,
        ``service_record``, and ``diagnosis`` keys.

    Raises:
        HTTPException 404: Session not found.
    """
    return build_summary(session_id=session_id, db=db)


@router.get(
    "/sessions/{session_id}/pdf",
    summary="Download session summary as a PDF",
    status_code=status.HTTP_200_OK,
)
def session_pdf_route(
    session_id: str,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> StreamingResponse:
    """Generate and stream a PDF report for the session.

    Calls ``build_summary()`` then renders a ReportLab A4 document containing
    vehicle details, customer info, symptoms, findings, and diagnosis solutions.

    Args:
        session_id: UUID string of the session.
        db: Injected SQLAlchemy session.

    Returns:
        A ``StreamingResponse`` with ``Content-Type: application/pdf``.

    Raises:
        HTTPException 404: Session not found.
    """
    summary = build_summary(session_id=session_id, db=db)
    pdf_bytes = _build_pdf(summary)
    filename = f"mechai-session-{session_id[:8]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

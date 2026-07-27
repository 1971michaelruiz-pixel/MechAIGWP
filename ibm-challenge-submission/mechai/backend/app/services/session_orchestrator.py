"""Session orchestrator — creates, advances, and summarises MechSession records."""

import uuid as _uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.service_record import ServiceRecord
from app.models.session import SESSION_STATES, MechSession
from app.models.vehicle import Vehicle
from app.services.diagnose import diagnose_by_vin


# ── Public API ─────────────────────────────────────────────────────────────────


def create_session(
    shop_id: str | None,
    mechanic_id: str | None,
    db: Session,
) -> MechSession:
    """Insert a new ``MechSession`` in the ``"listening"`` state.

    Args:
        shop_id: Optional shop UUID string.
        mechanic_id: Optional mechanic UUID string.
        db: Active SQLAlchemy session.

    Returns:
        The newly persisted ``MechSession`` instance.
    """
    row = MechSession(
        shop_id=_uuid.UUID(shop_id) if shop_id else None,
        mechanic_id=_uuid.UUID(mechanic_id) if mechanic_id else None,
        state="listening",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_session(session_id: str, db: Session) -> MechSession | None:
    """Retrieve a ``MechSession`` by primary key.

    Args:
        session_id: UUID string of the session.
        db: Active SQLAlchemy session.

    Returns:
        The ``MechSession`` row, or ``None`` if not found.
    """
    try:
        uid = _uuid.UUID(session_id)
    except ValueError:
        return None
    return db.get(MechSession, uid)


def advance_state(
    session_id: str,
    to_state: str,
    db: Session,
    **kwargs: Any,
) -> MechSession:
    """Advance the session to ``to_state`` and update any provided FK fields.

    Only linear forward transitions are permitted — you cannot skip states or
    move backwards.  The ``kwargs`` may contain ``vehicle_id``, ``customer_id``,
    and ``service_record_id`` (all UUID strings) which are written to the row.

    Args:
        session_id: UUID string identifying the session to update.
        to_state: Target state string; must be a legal next step.
        db: Active SQLAlchemy session.
        **kwargs: Optional FK field values (``vehicle_id``, ``customer_id``,
            ``service_record_id``).

    Returns:
        The updated ``MechSession`` row.

    Raises:
        HTTPException 404: Session not found.
        HTTPException 422: Transition is illegal.
    """
    row = get_session(session_id, db)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )

    # Validate linear transition
    if to_state not in SESSION_STATES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown state '{to_state}'.",
        )
    current_idx = SESSION_STATES.index(row.state)
    target_idx = SESSION_STATES.index(to_state)
    if target_idx != current_idx + 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Invalid transition from '{row.state}' to '{to_state}'. "
                f"Expected next state: '{SESSION_STATES[current_idx + 1]}'."
            ),
        )

    row.state = to_state

    # Apply optional FK updates
    if "vehicle_id" in kwargs and kwargs["vehicle_id"]:
        row.vehicle_id = _uuid.UUID(kwargs["vehicle_id"])
    if "customer_id" in kwargs and kwargs["customer_id"]:
        row.customer_id = _uuid.UUID(kwargs["customer_id"])
    if "service_record_id" in kwargs and kwargs["service_record_id"]:
        row.service_record_id = _uuid.UUID(kwargs["service_record_id"])

    db.commit()
    db.refresh(row)
    return row


def build_summary(session_id: str, db: Session) -> dict:
    """Assemble a full summary dict by joining all session-related records.

    When the session is in ``"complete"`` state the diagnosis engine is called
    to append ranked solutions.  In all other states ``diagnosis`` is ``None``.

    Args:
        session_id: UUID string of the session.
        db: Active SQLAlchemy session.

    Returns:
        A dict with keys ``session``, ``vehicle``, ``customer``,
        ``service_record``, and ``diagnosis``.

    Raises:
        HTTPException 404: Session not found.
    """
    row = get_session(session_id, db)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found.",
        )

    vehicle: Vehicle | None = db.get(Vehicle, row.vehicle_id) if row.vehicle_id else None
    customer: Customer | None = db.get(Customer, row.customer_id) if row.customer_id else None
    service_rec: ServiceRecord | None = (
        db.get(ServiceRecord, row.service_record_id) if row.service_record_id else None
    )

    diagnosis: list[dict] | None = None
    if row.state == "complete" and vehicle and vehicle.vin:
        tags = service_rec.symptom_tags if service_rec else []
        diagnosis = diagnose_by_vin(
            vin=vehicle.vin,
            symptom_tags=tags or [],
            shop_id=str(row.shop_id) if row.shop_id else None,
            db=db,
        )

    return {
        "session": {
            "id": str(row.id),
            "state": row.state,
            "shop_id": str(row.shop_id) if row.shop_id else None,
            "mechanic_id": str(row.mechanic_id) if row.mechanic_id else None,
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
        },
        "vehicle": (
            {
                "id": str(vehicle.id),
                "vin": vehicle.vin,
                "make": vehicle.make,
                "model": vehicle.model,
                "year": vehicle.year,
                "trim": vehicle.trim,
                "engine": vehicle.engine,
                "body_style": vehicle.body_style,
            }
            if vehicle
            else None
        ),
        "customer": (
            {
                "id": str(customer.id),
                "first_name": customer.first_name,
                "last_name": customer.last_name,
                "phone": customer.phone,
                "email": customer.email,
            }
            if customer
            else None
        ),
        "service_record": (
            {
                "id": str(service_rec.id),
                "presented_symptoms": service_rec.presented_symptoms,
                "inspection_findings": service_rec.inspection_findings,
                "symptom_tags": service_rec.symptom_tags,
                "visit_date": service_rec.visit_date.isoformat(),
            }
            if service_rec
            else None
        ),
        "diagnosis": diagnosis,
    }

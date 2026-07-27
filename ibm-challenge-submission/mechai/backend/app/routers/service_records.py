"""Service record endpoints: create a record and retrieve history by VIN."""

# POST /api/service-records      — create a new service visit record
# GET  /api/vehicles/{vin}/history — ordered history for a given VIN

import uuid as _uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.service_record import ServiceRecord
from app.models.vehicle import Vehicle
from app.services.symptom_extract import extract_symptom_tags

router = APIRouter(prefix="/api", tags=["service-records"])


# ── Request / Response schemas ─────────────────────────────────────────────────


class CreateServiceRecordRequest(BaseModel):
    """Body for POST /api/service-records."""

    vehicle_id: str
    shop_id: str | None = None
    mechanic_id: str | None = None
    presented_symptoms: str | None = None
    inspection_findings: str | None = None


class ServiceRecordResponse(BaseModel):
    """Service record representation returned by both endpoints."""

    id: str
    vehicle_id: str
    shop_id: str | None
    mechanic_id: str | None
    visit_date: datetime
    presented_symptoms: str | None
    inspection_findings: str | None
    symptom_tags: list[str] | None
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ────────────────────────────────────────────────────────────────────


def _record_to_response(row: ServiceRecord) -> ServiceRecordResponse:
    """Convert a ``ServiceRecord`` ORM row to a ``ServiceRecordResponse`` schema."""
    return ServiceRecordResponse(
        id=str(row.id),
        vehicle_id=str(row.vehicle_id),
        shop_id=str(row.shop_id) if row.shop_id else None,
        mechanic_id=str(row.mechanic_id) if row.mechanic_id else None,
        visit_date=row.visit_date,
        presented_symptoms=row.presented_symptoms,
        inspection_findings=row.inspection_findings,
        symptom_tags=row.symptom_tags,
        created_at=row.created_at,
    )


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.post(
    "/service-records",
    response_model=ServiceRecordResponse,
    summary="Create a new service visit record",
    status_code=status.HTTP_201_CREATED,
)
def create_service_record(
    body: CreateServiceRecordRequest,
    db: Session = Depends(get_db),
) -> ServiceRecordResponse:
    """Insert a new service record and return it.

    If both ``presented_symptoms`` and ``inspection_findings`` are provided,
    GPT-4o is called to extract structured ``symptom_tags`` before persisting.

    Args:
        body: Service record details.  ``vehicle_id`` is required.
        db: Injected SQLAlchemy session.

    Returns:
        The newly created ``ServiceRecordResponse``.

    Raises:
        HTTPException 404: If the referenced vehicle cannot be found.
    """
    vehicle_uuid = _uuid.UUID(body.vehicle_id)

    vehicle = db.get(Vehicle, vehicle_uuid)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle '{body.vehicle_id}' not found.",
        )

    # ── LLM tag extraction when both phases are present ────────────────────────
    tags: list[str] | None = None
    if body.presented_symptoms and body.inspection_findings:
        tags = extract_symptom_tags(body.presented_symptoms, body.inspection_findings)

    row = ServiceRecord(
        vehicle_id=vehicle_uuid,
        shop_id=_uuid.UUID(body.shop_id) if body.shop_id else None,
        mechanic_id=_uuid.UUID(body.mechanic_id) if body.mechanic_id else None,
        presented_symptoms=body.presented_symptoms,
        inspection_findings=body.inspection_findings,
        symptom_tags=tags,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _record_to_response(row)


@router.get(
    "/vehicles/{vin}/history",
    response_model=list[ServiceRecordResponse],
    summary="Retrieve full service history for a vehicle by VIN",
    status_code=status.HTTP_200_OK,
)
def get_vehicle_history(
    vin: str = Path(..., min_length=17, max_length=17, description="17-character VIN."),
    db: Session = Depends(get_db),
) -> list[ServiceRecordResponse]:
    """Return all service records for the vehicle identified by *vin*.

    Joins ``service_records`` → ``vehicles`` on ``vehicle_id`` filtering by
    ``vehicles.vin``.  Results are ordered by ``visit_date DESC`` so the most
    recent visit appears first.

    Args:
        vin: The 17-character VIN string.
        db: Injected SQLAlchemy session.

    Returns:
        A (possibly empty) list of ``ServiceRecordResponse`` objects.
    """
    rows = (
        db.query(ServiceRecord)
        .join(Vehicle, ServiceRecord.vehicle_id == Vehicle.id)
        .filter(Vehicle.vin == vin.upper())
        .order_by(ServiceRecord.visit_date.desc())
        .all()
    )
    return [_record_to_response(r) for r in rows]

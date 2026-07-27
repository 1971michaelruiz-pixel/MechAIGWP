"""Vehicle endpoints: VIN decode and vehicle profile upsert."""

# POST /api/vehicles/decode  — extract VIN from transcript or direct input, call NHTSA
# POST /api/vehicles         — persist (upsert on VIN) a confirmed vehicle profile

import uuid as _uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.vehicle import Vehicle
from app.services.vin import decode_vin, extract_vin

router = APIRouter(prefix="/api", tags=["vehicles"])


# ── Request / Response schemas ─────────────────────────────────────────────────


class DecodeRequest(BaseModel):
    """Body for POST /api/vehicles/decode.

    Provide either ``vin`` directly or ``transcript`` (the mechanic's spoken
    text) — if ``transcript`` is given, the VIN is extracted automatically.
    At least one of the two fields must be present.
    """

    vin: str | None = Field(None, min_length=17, max_length=17, description="17-char VIN.")
    transcript: str | None = Field(None, description="Free-form transcript to extract VIN from.")


class VehicleData(BaseModel):
    """Decoded vehicle attributes returned by /decode and /vehicles."""

    vin: str
    make: str | None
    model: str | None
    year: int | None
    trim: str | None
    engine: str | None
    body_style: str | None


class CreateVehicleRequest(BaseModel):
    """Body for POST /api/vehicles."""

    vin: str = Field(..., min_length=17, max_length=17)
    make: str | None = None
    model: str | None = None
    year: int | None = None
    trim: str | None = None
    engine: str | None = None
    body_style: str | None = None
    shop_id: str | None = None


class VehicleResponse(VehicleData):
    """Full vehicle record including database metadata."""

    id: str
    shop_id: str | None

    class Config:
        from_attributes = True


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.post(
    "/vehicles/decode",
    response_model=VehicleData,
    summary="Decode a VIN via the NHTSA vPIC API",
    status_code=status.HTTP_200_OK,
)
def decode_vehicle(body: DecodeRequest) -> VehicleData:
    """Extract a VIN from a transcript (or accept one directly) and decode it.

    Args:
        body: Must contain at least one of ``vin`` or ``transcript``.

    Returns:
        ``VehicleData`` with the NHTSA-decoded vehicle attributes.

    Raises:
        HTTPException 422: If no VIN can be found in the provided transcript and
            no ``vin`` field was given.
        HTTPException 502: If the NHTSA vPIC HTTP call fails or returns an error.
    """
    vin = body.vin

    if not vin:
        if not body.transcript:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Provide either 'vin' or 'transcript' in the request body.",
            )
        vin = extract_vin(body.transcript)
        if not vin:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "No valid 17-character VIN found in the transcript. "
                    "Please enter the VIN manually."
                ),
            )

    try:
        result = decode_vin(vin)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"NHTSA vPIC request failed: {exc}",
        ) from exc

    return VehicleData(
        vin=result["vin"],
        make=result.get("make"),
        model=result.get("model"),
        year=result.get("year"),
        trim=result.get("trim"),
        engine=result.get("engine"),
        body_style=result.get("body_style"),
    )


@router.post(
    "/vehicles",
    response_model=VehicleResponse,
    summary="Create or update a vehicle profile",
    status_code=status.HTTP_200_OK,
)
def upsert_vehicle(
    body: CreateVehicleRequest,
    db: Session = Depends(get_db),
) -> VehicleResponse:
    """Upsert a vehicle record keyed on ``vin``.

    If a row with the given VIN already exists it is updated in place; otherwise
    a new row is inserted.  The ``raw_nhtsa_response`` column is intentionally
    not exposed here — it is set by internal decode paths only.

    Args:
        body: Vehicle attributes.  ``vin`` is mandatory; all other fields are
            optional to support partial updates.
        db: Injected SQLAlchemy session.

    Returns:
        The full ``VehicleResponse`` reflecting the current database state.
    """
    values: dict = {
        "vin": body.vin.upper().strip(),
        "make": body.make,
        "model": body.model,
        "year": body.year,
        "trim": body.trim,
        "engine": body.engine,
        "body_style": body.body_style,
        "shop_id": _uuid.UUID(body.shop_id) if body.shop_id else None,
    }

    stmt = (
        pg_insert(Vehicle)
        .values(id=_uuid.uuid4(), **values)
        .on_conflict_do_update(
            index_elements=["vin"],
            set_={k: v for k, v in values.items() if k != "vin"},
        )
        .returning(Vehicle)
    )

    row: Vehicle = db.execute(stmt).scalars().one()
    db.commit()

    return VehicleResponse(
        id=str(row.id),
        vin=row.vin,
        make=row.make,
        model=row.model,
        year=row.year,
        trim=row.trim,
        engine=row.engine,
        body_style=row.body_style,
        shop_id=str(row.shop_id) if row.shop_id else None,
    )

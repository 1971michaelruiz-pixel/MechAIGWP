"""Customer endpoints: search, create, and vehicle assignment."""

# GET  /api/customers/search  — fuzzy name/phone search
# POST /api/customers          — create new customer record
# POST /api/customer-vehicles  — assign a vehicle to a customer

import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import or_, update
from sqlalchemy.orm import Session

from app.auth import TokenPayload, get_current_user
from app.db import get_db
from app.models.customer import Customer
from app.models.customer_vehicle import CustomerVehicle
from app.models.vehicle import Vehicle
from app.services.customer_extract import extract_customer_name

router = APIRouter(prefix="/api", tags=["customers"])


# ── Request / Response schemas ──────────────────────────────────────────────────


class CustomerSummary(BaseModel):
    """Minimal customer representation returned by search and create endpoints."""

    id: str
    first_name: str
    last_name: str
    phone: str | None
    email: str | None

    class Config:
        from_attributes = True


class CreateCustomerRequest(BaseModel):
    """Body for POST /api/customers."""

    first_name: str
    last_name: str
    phone: str | None = None
    email: str | None = None
    shop_id: str | None = None


class AssignVehicleRequest(BaseModel):
    """Body for POST /api/customer-vehicles.

    Either ``customer_id`` or ``transcript`` must be provided.  When only
    ``transcript`` is given the endpoint uses GPT-4o to extract a name and
    resolves the customer via fuzzy search.
    """

    customer_id: str | None = None
    vehicle_id: str
    transcript: str | None = None


class VehicleSummary(BaseModel):
    """Minimal vehicle fields embedded in the assignment response."""

    id: str
    vin: str
    make: str | None
    model: str | None
    year: int | None


class AssignVehicleResponse(BaseModel):
    """Full assignment record with nested customer and vehicle summaries."""

    id: str
    customer: CustomerSummary
    vehicle: VehicleSummary
    is_current_owner: bool


# ── Helpers ─────────────────────────────────────────────────────────────────────


def _customer_to_summary(row: Customer) -> CustomerSummary:
    """Convert a ``Customer`` ORM row to a ``CustomerSummary`` schema."""
    return CustomerSummary(
        id=str(row.id),
        first_name=row.first_name,
        last_name=row.last_name,
        phone=row.phone,
        email=row.email,
    )


# ── Routes ──────────────────────────────────────────────────────────────────────


@router.get(
    "/customers/search",
    response_model=list[CustomerSummary],
    summary="Fuzzy search customers by name or phone",
    status_code=status.HTTP_200_OK,
)
def search_customers(
    q: str = Query(..., min_length=1, description="Name or phone fragment to search for."),
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> list[CustomerSummary]:
    """Return up to 20 customers whose full name or phone contains *q*.

    The match is case-insensitive and uses a simple ``ILIKE %q%`` pattern on
    ``first_name || ' ' || last_name`` and on ``phone``.  No pg_trgm extension
    is required.

    Args:
        q: The search string.
        db: Injected SQLAlchemy session.

    Returns:
        A list of up to 20 matching ``CustomerSummary`` objects.
    """
    pattern = f"%{q}%"
    rows = (
        db.query(Customer)
        .filter(
            or_(
                (Customer.first_name + " " + Customer.last_name).ilike(pattern),
                Customer.phone.ilike(pattern),
            )
        )
        .limit(20)
        .all()
    )
    return [_customer_to_summary(r) for r in rows]


@router.post(
    "/customers",
    response_model=CustomerSummary,
    summary="Create a new customer record",
    status_code=status.HTTP_201_CREATED,
)
def create_customer(
    body: CreateCustomerRequest,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> CustomerSummary:
    """Insert a new customer row and return it.

    A 409 is raised if a customer with the same ``first_name``, ``last_name``,
    and ``shop_id`` already exists in the database (prevents accidental
    duplicates from rapid-fire form submissions).

    Args:
        body: Customer details.  ``first_name`` and ``last_name`` are required.
        db: Injected SQLAlchemy session.

    Returns:
        The newly created ``CustomerSummary``.

    Raises:
        HTTPException 409: If a matching customer already exists.
    """
    shop_uuid = _uuid.UUID(body.shop_id) if body.shop_id else None

    existing = (
        db.query(Customer)
        .filter(
            Customer.first_name == body.first_name,
            Customer.last_name == body.last_name,
            Customer.shop_id == shop_uuid,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A customer named '{body.first_name} {body.last_name}' already exists "
                "for this shop."
            ),
        )

    row = Customer(
        first_name=body.first_name,
        last_name=body.last_name,
        phone=body.phone,
        email=body.email,
        shop_id=shop_uuid,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _customer_to_summary(row)


@router.post(
    "/customer-vehicles",
    response_model=AssignVehicleResponse,
    summary="Assign a vehicle to a customer",
    status_code=status.HTTP_201_CREATED,
)
def assign_vehicle(
    body: AssignVehicleRequest,
    db: Session = Depends(get_db),
    user: TokenPayload = Depends(get_current_user),
) -> AssignVehicleResponse:
    """Create a customer–vehicle ownership record.

    If ``customer_id`` is not provided but ``transcript`` is, the endpoint
    calls GPT-4o to extract the customer name from the transcript and resolves
    it via fuzzy search.  The first matching customer is used.

    Any existing ``CustomerVehicle`` rows for the same vehicle are flipped to
    ``is_current_owner=False`` before the new row is inserted.

    Args:
        body: Must contain ``vehicle_id`` and either ``customer_id`` or
            ``transcript``.
        db: Injected SQLAlchemy session.

    Returns:
        The created ``AssignVehicleResponse`` with nested customer and vehicle.

    Raises:
        HTTPException 400: If neither ``customer_id`` nor ``transcript`` is
            supplied, or if name extraction yields no result.
        HTTPException 404: If the customer or vehicle cannot be found.
    """
    vehicle_uuid = _uuid.UUID(body.vehicle_id)

    # ── Resolve customer ───────────────────────────────────────────────────────
    if body.customer_id:
        customer_uuid = _uuid.UUID(body.customer_id)
        customer = db.get(Customer, customer_uuid)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer '{body.customer_id}' not found.",
            )
    elif body.transcript:
        extracted_name = extract_customer_name(body.transcript)
        if not extracted_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract a customer name from the provided transcript.",
            )
        # Fuzzy search using the extracted name
        pattern = f"%{extracted_name}%"
        customer = (
            db.query(Customer)
            .filter(
                (Customer.first_name + " " + Customer.last_name).ilike(pattern)
            )
            .first()
        )
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No customer found matching name '{extracted_name}'.",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either 'customer_id' or 'transcript' in the request body.",
        )

    # ── Resolve vehicle ────────────────────────────────────────────────────────
    vehicle = db.get(Vehicle, vehicle_uuid)
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vehicle '{body.vehicle_id}' not found.",
        )

    # ── Clear previous ownership flags for this vehicle ────────────────────────
    db.execute(
        update(CustomerVehicle)
        .where(CustomerVehicle.vehicle_id == vehicle_uuid)
        .values(is_current_owner=False)
    )

    # ── Create new assignment ──────────────────────────────────────────────────
    assignment = CustomerVehicle(
        customer_id=customer.id,
        vehicle_id=vehicle.id,
        is_current_owner=True,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    return AssignVehicleResponse(
        id=str(assignment.id),
        customer=_customer_to_summary(customer),
        vehicle=VehicleSummary(
            id=str(vehicle.id),
            vin=vehicle.vin,
            make=vehicle.make,
            model=vehicle.model,
            year=vehicle.year,
        ),
        is_current_owner=assignment.is_current_owner,
    )

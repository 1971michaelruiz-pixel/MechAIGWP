"""POST /api/diagnose — provider-agnostic symptom matching and solution ranking."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.services.diagnose import diagnose, diagnose_by_vin

router = APIRouter(prefix="/api", tags=["diagnose"])


# ── Request / Response schemas ─────────────────────────────────────────────────


class DiagnoseRequest(BaseModel):
    """Body for POST /api/diagnose.

    Supply either ``vin`` (looks up make/model/year from the vehicles table)
    or ``make`` + ``model`` + ``year`` directly.  ``symptom_tags`` drives the
    matching — pass the tags extracted by the service-record pipeline.
    """

    vin: str | None = None
    make: str | None = None
    model: str | None = None
    year: int | None = None
    symptom_tags: list[str] = []
    shop_id: str | None = None


class SolutionItem(BaseModel):
    """A single ranked repair solution returned by the diagnosis engine."""

    rank: int
    description: str
    source_citation: str
    labor_hours: float | None
    confidence_score: float


# ── Route ──────────────────────────────────────────────────────────────────────


@router.post(
    "/diagnose",
    response_model=list[SolutionItem],
    summary="Run symptom matching and return ranked repair solutions",
    status_code=status.HTTP_200_OK,
)
def run_diagnosis(
    body: DiagnoseRequest,
    db: Session = Depends(get_db),
) -> list[SolutionItem]:
    """Match symptom tags against repair data and return GPT-4o ranked solutions.

    The engine queries the active ``RepairDataProvider`` for the shop (or the
    default ``NHTSAProvider`` if no shop is set), combines TSBs and community
    threads, then synthesises ranked plain-language solutions via GPT-4o.

    Args:
        body: Must contain ``symptom_tags`` and either ``vin`` or
            ``make`` + ``model`` + ``year``.
        db: Injected SQLAlchemy session.

    Returns:
        Up to 5 ``SolutionItem`` objects ordered by descending confidence.

    Raises:
        HTTPException 422: If neither VIN nor make/model/year is provided.
    """
    if body.vin:
        solutions = diagnose_by_vin(
            vin=body.vin,
            symptom_tags=body.symptom_tags,
            shop_id=body.shop_id,
            db=db,
        )
    elif body.make and body.model and body.year:
        solutions = diagnose(
            make=body.make,
            model=body.model,
            year=body.year,
            symptom_tags=body.symptom_tags,
            shop_id=body.shop_id,
            db=db,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide either 'vin' or 'make' + 'model' + 'year' in the request body.",
        )

    # Normalise and validate each solution from GPT-4o output
    items: list[SolutionItem] = []
    for i, sol in enumerate(solutions[:5]):
        if not isinstance(sol, dict):
            continue
        try:
            items.append(
                SolutionItem(
                    rank=int(sol.get("rank", i + 1)),
                    description=str(sol.get("description", "")),
                    source_citation=str(sol.get("source_citation", "")),
                    labor_hours=float(sol["labor_hours"]) if sol.get("labor_hours") is not None else None,
                    confidence_score=float(sol.get("confidence_score", 0.0)),
                )
            )
        except (TypeError, ValueError):
            continue

    return items

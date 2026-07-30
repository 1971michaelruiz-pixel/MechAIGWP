"""Health-check router."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
def health_check() -> HealthResponse:
    """Returns service status. Used by load-balancers and CI smoke tests."""
    from app.config import settings

    return HealthResponse(
        status="ok",
        version="0.1.0",
        environment=settings.app_env,
    )

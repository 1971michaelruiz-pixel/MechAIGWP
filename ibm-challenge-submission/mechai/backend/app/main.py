"""MechAI FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine
from app.routers import customers, dialect, diagnose, health, service_records, sessions, transcribe, vehicles


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Create all tables on startup (dev convenience — use Alembic for production)."""
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="MechAI API",
    version="0.1.0",
    description="AI-powered automotive diagnostic and repair-estimate platform.",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(transcribe.router)
app.include_router(vehicles.router)
app.include_router(customers.router)
app.include_router(service_records.router)
app.include_router(dialect.router)
app.include_router(diagnose.router)
app.include_router(sessions.router)

"""MechAI FastAPI application entry point."""

import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.limiter import limiter
from app.routers import customers, dialect, diagnose, health, service_records, sessions, transcribe, vehicles

# ── Structured logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("mechai")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan hook.

    Database schema changes are managed by Alembic migrations — run
    ``alembic upgrade head`` before starting the server.  The old
    ``create_all`` call has been removed to prevent silent schema drift
    in production.
    """
    logger.info("MechAI API starting (env=%s)", settings.app_env)
    yield
    logger.info("MechAI API shutting down")


app = FastAPI(
    title="MechAI API",
    version="0.1.0",
    description="AI-powered automotive diagnostic and repair-estimate platform.",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url="/redoc" if settings.app_env != "production" else None,
    lifespan=lifespan,
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging middleware ─────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log method, path, status code, and latency for every request."""
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s %s %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


# ── Global exception handler ───────────────────────────────────────────────────
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch any unhandled exception and return a generic 500 without leaking
    stack traces to the client.  The full traceback is logged server-side."""
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again later."},
    )


# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(transcribe.router)
app.include_router(vehicles.router)
app.include_router(customers.router)
app.include_router(service_records.router)
app.include_router(dialect.router)
app.include_router(diagnose.router)
app.include_router(sessions.router)

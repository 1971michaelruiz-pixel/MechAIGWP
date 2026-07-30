"""Shared SlowAPI limiter instance.

Imported by routers that need per-route rate limiting.
The limiter is registered on ``app.state`` in ``main.py``.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# Single shared instance — routers import this directly.
limiter = Limiter(key_func=get_remote_address, default_limits=[])

# Convenience limit string built from settings so it can be tuned via env var.
AI_RATE_LIMIT = f"{settings.rate_limit_per_minute}/minute"

"""JWT authentication dependency for FastAPI routes.

All protected routes depend on ``get_current_user``.  The /health endpoint
is intentionally left public for load-balancer probes.

Token format expected::

    Authorization: Bearer <supabase-issued-jwt>

The JWT is verified using the ``SUPABASE_JWT_SECRET`` (HS256).  The decoded
payload is returned as a ``TokenPayload`` so route handlers can access
``user_id``, ``shop_id``, and ``role`` without re-decoding.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt
from pydantic import BaseModel

from app.config import settings

_bearer = HTTPBearer(auto_error=True)


class TokenPayload(BaseModel):
    """Decoded claims from a Supabase-issued JWT.

    ``sub`` is the Supabase user UUID.
    ``shop_id`` is stored in the custom ``app_metadata.shop_id`` claim.
    ``role`` is stored in ``app_metadata.role`` (admin | mechanic | writer).
    """

    sub: str
    shop_id: str | None = None
    role: str | None = None


def _decode(token: str) -> dict:
    """Decode and verify a Supabase JWT, raising 401 on any failure."""
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase does not set a standard aud
        )
    except ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> TokenPayload:
    """FastAPI dependency — validates the Bearer token and returns its payload.

    Usage::

        @router.get("/example")
        def example(user: TokenPayload = Depends(get_current_user)) -> ...:
            ...
    """
    payload = _decode(credentials.credentials)
    app_meta: dict = payload.get("app_metadata") or {}
    return TokenPayload(
        sub=payload["sub"],
        shop_id=app_meta.get("shop_id"),
        role=app_meta.get("role"),
    )


def require_role(*roles: str):
    """Return a dependency that enforces one of the given roles.

    Usage::

        @router.delete("/admin/thing")
        def delete_thing(
            user: TokenPayload = Depends(require_role("admin"))
        ) -> ...:
            ...
    """

    def _check(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {' or '.join(roles)}.",
            )
        return user

    return _check

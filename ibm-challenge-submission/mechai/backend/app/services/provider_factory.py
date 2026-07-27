"""Runtime provider resolution based on tenant settings."""

import uuid

from sqlalchemy.orm import Session

from app.config import settings
from app.models.tenant_settings import TenantSettings
from app.providers.base import RepairDataProvider
from app.providers.generic_api_provider import GenericAPIProvider
from app.providers.imported_provider import ImportedDataProvider
from app.providers.nhtsa_provider import NHTSAProvider


def get_provider(shop_id: str | None, db: Session) -> RepairDataProvider:
    """Resolve and return the appropriate ``RepairDataProvider`` for a shop.

    Resolution order:
    1. Look up ``TenantSettings`` for *shop_id* (if provided).
    2. Instantiate the provider named in ``repair_data_provider``.
    3. Fall back to ``NHTSAProvider`` when no settings row exists, *shop_id*
       is ``None``, or the provider name is unrecognised.

    Args:
        shop_id: Optional UUID string identifying the requesting shop.
        db: Active SQLAlchemy session (required for ``ImportedDataProvider``).

    Returns:
        A concrete ``RepairDataProvider`` instance ready to query.
    """
    provider_name: str = settings.default_repair_provider

    if shop_id:
        try:
            shop_uuid = uuid.UUID(shop_id)
            row: TenantSettings | None = (
                db.query(TenantSettings)
                .filter(TenantSettings.shop_id == shop_uuid)
                .first()
            )
            if row:
                provider_name = row.repair_data_provider
        except (ValueError, Exception):  # noqa: BLE001
            pass  # Malformed UUID or DB error — fall back to default

    if provider_name == "imported":
        return ImportedDataProvider(db=db, shop_id=shop_id)

    if provider_name == "generic_api" and shop_id:
        try:
            shop_uuid = uuid.UUID(shop_id)
            row = (
                db.query(TenantSettings)
                .filter(TenantSettings.shop_id == shop_uuid)
                .first()
            )
            if row and row.generic_api_url:
                return GenericAPIProvider(
                    api_url=row.generic_api_url,
                    api_key=row.generic_api_key,
                )
        except Exception:  # noqa: BLE001
            pass

    # Default — always safe, no config required
    return NHTSAProvider()

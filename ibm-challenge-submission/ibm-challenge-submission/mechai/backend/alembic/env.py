"""Alembic environment — loads DATABASE_URL from settings and auto-generates
migration scripts from the SQLAlchemy metadata."""

import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# ── Make app importable from this directory ───────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import settings  # noqa: E402
from app.db import Base  # noqa: E402

# Import every model module so their tables are registered on Base.metadata.
# Add new models here as the schema grows.
import app.models.community_thread  # noqa: F401, E402
import app.models.customer  # noqa: F401, E402
import app.models.customer_vehicle  # noqa: F401, E402
import app.models.dialect_candidate  # noqa: F401, E402
import app.models.dialect_term  # noqa: F401, E402
import app.models.service_record  # noqa: F401, E402
import app.models.session  # noqa: F401, E402
import app.models.tenant_settings  # noqa: F401, E402
import app.models.transcription  # noqa: F401, E402
import app.models.tsb_record  # noqa: F401, E402
import app.models.vehicle  # noqa: F401, E402

# ── Alembic Config ────────────────────────────────────────────────────────────
config = context.config

# Override the sqlalchemy.url with the value from our settings (reads .env).
config.set_main_option("sqlalchemy.url", settings.database_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The target metadata for autogenerate support.
target_metadata = Base.metadata


# ── Migration runners ─────────────────────────────────────────────────────────


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (emit SQL to stdout — no DB connection)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (direct DB connection)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

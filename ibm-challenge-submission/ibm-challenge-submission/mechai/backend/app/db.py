"""Database engine, declarative base, and session dependency."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    # Recycle connections every 30 min to avoid stale sockets
    pool_recycle=1800,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models."""


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and closes it after use.

    Usage::

        @router.get("/example")
        def example(db: Session = Depends(get_db)) -> ...:
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

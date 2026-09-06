"""
Database connection management.

Wraps SQLAlchemy's engine and session creation behind a small helper so
the rest of the codebase never imports SQLAlchemy engine internals
directly. Connection settings are read from environment variables so
the same code works in development, testing, and production.
"""

import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://semanticode:semanticode@localhost:5432/semanticode",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=10)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@contextmanager
def get_db_session():
    """
    Provide a transactional database session as a context manager.

    Usage:
        with get_db_session() as session:
            session.query(User).all()

    The session is always closed on exit, and any uncommitted changes
    are rolled back if an exception propagates out of the block.
    """
    session = SessionLocal()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_connection() -> bool:
    """Ping the database to confirm connectivity (used by health checks)."""
    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False

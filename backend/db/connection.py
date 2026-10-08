"""
Database connection management.

Wraps SQLAlchemy's engine and session creation behind a small helper so
the rest of the codebase never imports SQLAlchemy engine internals
directly. Connection settings are read from environment variables so
the same code works in development, testing, and production.
"""

import os
from contextlib import contextmanager

from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

BASE_DIR = Path(__file__).resolve().parents[1]
# SQLite makes the project immediately runnable for a classroom demo.  Set
# DATABASE_URL to a PostgreSQL URL in production without changing any routes.
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'semanticode.db'}")

engine_options = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, **engine_options)
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
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False

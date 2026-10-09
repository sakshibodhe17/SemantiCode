"""Database connection and user repository (SQLite for the demo)."""
import sqlite3
from contextlib import contextmanager

DB_PATH = "shop.db"


@contextmanager
def get_connection():
    """Open a SQLite connection, commit on success and roll back on error."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class UserRepository:
    """All SQL that touches the users table."""

    def find_by_email(self, email: str):
        with get_connection() as conn:
            return conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    def create_user(self, email: str, password_hash: str, role: str = "customer") -> int:
        """Register a new account and return its id."""
        with get_connection() as conn:
            cur = conn.execute(
                "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
                (email, password_hash, role),
            )
            return cur.lastrowid

    def delete_user(self, user_id: int) -> None:
        with get_connection() as conn:
            conn.execute("DELETE FROM users WHERE id = ?", (user_id,))

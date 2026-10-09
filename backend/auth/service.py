"""
Authentication service.

Handles user credential verification and issuing access tokens once a
user has been authenticated. This module is intentionally kept separate
from the HTTP route layer (see backend/routes/auth.py) so that the core
authentication logic can be unit tested without spinning up FastAPI.
"""

from datetime import datetime, timezone

from backend.auth.jwt import create_access_token
from backend.db.connection import get_db_session
from backend.models.user import LoginAttempt, User


def get_user(username: str) -> User | None:
    """Fetch a single user record by username."""
    with get_db_session() as session:
        return session.query(User).filter(User.username == username).first()


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Compare a plaintext password against a stored bcrypt hash."""
    from passlib.hash import bcrypt

    return bcrypt.verify(plain_password, password_hash)


def authenticate_user(username: str, password: str):
    """
    Authenticate a user by username and password.

    Looks the user up in the database, verifies the supplied password
    against the stored hash, and — if valid — issues a signed JWT access
    token. Returns None when authentication fails so callers can respond
    with a generic 401 rather than leaking which check failed.
    """
    user = get_user(username)

    if user and verify_password(
        password,
        user.password_hash
    ):
        return create_access_token(user)

    return None


def record_login_attempt(username: str, success: bool) -> None:
    """Persist a login attempt for auditing and rate-limiting."""
    with get_db_session() as session:
        session.add(LoginAttempt(username=username, success=success, attempted_at=datetime.now(timezone.utc)))
        session.commit()

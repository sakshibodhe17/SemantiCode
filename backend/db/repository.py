"""
Repository layer for user data access.

Groups related database queries behind a small class so route handlers
and services don't need to know SQLAlchemy query syntax directly. This
is the kind of class-based result the search UI should be able to show
alongside plain module-level functions (see backend/auth/service.py).
"""

from backend.db.connection import get_db_session
from backend.models.user import User


class UserRepository:
    """Data-access methods for the User model."""

    def get_by_username(self, username: str) -> User | None:
        """Look up a single user by username."""
        with get_db_session() as session:
            return (
                session.query(User)
                .filter(User.username == username)
                .first()
            )

    def get_by_id(self, user_id: int) -> User | None:
        """Look up a single user by primary key."""
        with get_db_session() as session:
            return session.query(User).get(user_id)

    def create(self, username: str, email: str, password_hash: str) -> User:
        """Insert a new user row and return the created record."""
        with get_db_session() as session:
            user = User(username=username, email=email, password_hash=password_hash)
            session.add(user)
            session.commit()
            session.refresh(user)
            return user

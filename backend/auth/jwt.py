"""
JWT token creation and verification utilities.

Centralizes everything related to signing and validating JSON Web Tokens
so that the access-token format (claims, expiry, algorithm) only needs
to change in one place.
"""

import os
from datetime import datetime, timedelta

import jwt as pyjwt

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "development-only-change-this-to-a-32-byte-secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(user, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    """Create a signed JWT access token for an authenticated user."""
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "exp": expire,
    }
    return pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict | None:
    """
    Decode and validate a JWT access token.

    Returns the decoded claims when the token is well-formed, correctly
    signed, and not expired. Returns None for any failure so the caller
    can uniformly respond with 401 Unauthorized.
    """
    try:
        return pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except pyjwt.ExpiredSignatureError:
        return None
    except pyjwt.InvalidTokenError:
        return None


def refresh_access_token(token: str) -> str | None:
    """Issue a new access token if the supplied token is still valid."""
    claims = verify_token(token)
    if claims is None:
        return None

    payload = {
        "sub": claims["sub"],
        "username": claims["username"],
        "role": claims["role"],
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

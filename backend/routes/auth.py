"""
Authentication HTTP routes.

Thin FastAPI route handlers that delegate to backend.auth.service for
the actual authentication logic. Kept thin on purpose: the route layer
only deals with request/response shapes and HTTP status codes.
"""

from fastapi import APIRouter, HTTPException, status

from backend.auth.service import authenticate_user, record_login_attempt
from backend.schemas.auth import LoginRequest, LoginResponse, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest):
    """
    Authenticate a user and return a JWT access token.

    This is the endpoint the frontend calls when a user submits the
    login form. On success it returns a bearer token; on failure it
    returns 401 without indicating whether the username or password
    was wrong.
    """
    token = authenticate_user(payload.username, payload.password)
    record_login_attempt(payload.username, success=token is not None)

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    return LoginResponse(access_token=token, token_type="bearer")


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    """Create a new user account."""
    # Delegates to the user service; kept as a stub in this sample repo.
    raise HTTPException(status_code=501, detail="Not implemented in sample repo")


@router.post("/logout")
def logout():
    """Invalidate the current session (client discards the token)."""
    return {"status": "ok"}

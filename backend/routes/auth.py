"""
Authentication HTTP routes.

Thin FastAPI route handlers that delegate to backend.auth.service for
the actual authentication logic. Kept thin on purpose: the route layer
only deals with request/response shapes and HTTP status codes.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.auth.jwt import verify_token
from backend.auth.service import authenticate_user, record_login_attempt
from backend.db.connection import get_db_session
from backend.models.user import User
from backend.schemas.auth import LoginRequest, LoginResponse, RegisterRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    """FastAPI dependency: validate the Bearer JWT and return its claims."""
    claims = verify_token(credentials.credentials) if credentials else None
    if claims is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid token",
                            headers={"WWW-Authenticate": "Bearer"})
    return claims


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
    from passlib.hash import bcrypt

    with get_db_session() as session:
        if session.query(User).filter((User.username == payload.username) | (User.email == payload.email)).first():
            raise HTTPException(status_code=409, detail="Username or email already exists")
        user = User(username=payload.username, email=payload.email, password_hash=bcrypt.hash(payload.password))
        session.add(user)
        session.commit()
    return {"status": "created"}


@router.get("/me")
def me(claims: dict = Depends(current_user)):
    """Return the identity inside a valid access token (demonstrates JWT verification)."""
    return {"id": claims["sub"], "username": claims["username"], "role": claims["role"]}


@router.post("/logout")
def logout():
    """Invalidate the current session (client discards the token)."""
    return {"status": "ok"}

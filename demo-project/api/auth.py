"""Authentication: password hashing, login and JWT access tokens."""
import hashlib
import hmac
import os
import time

import jwt

SECRET = os.environ.get("SHOP_SECRET", "dev-secret")
TOKEN_TTL_SECONDS = 3600


def hash_password(password: str, salt: bytes | None = None) -> str:
    """Hash a password with PBKDF2-SHA256 and a random salt."""
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return salt.hex() + ":" + digest.hex()


def check_password(password: str, stored: str) -> bool:
    """Constant-time comparison of a password against its stored hash."""
    salt_hex, _ = stored.split(":")
    return hmac.compare_digest(hash_password(password, bytes.fromhex(salt_hex)), stored)


def issue_token(user_id: int, role: str = "customer") -> str:
    """Create a signed JWT that expires after TOKEN_TTL_SECONDS."""
    now = int(time.time())
    claims = {"sub": str(user_id), "role": role, "iat": now, "exp": now + TOKEN_TTL_SECONDS}
    return jwt.encode(claims, SECRET, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    """Return the claims of a valid token, or None if it is expired or forged."""
    try:
        return jwt.decode(token, SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


class LoginService:
    """Checks credentials and hands out access tokens."""

    def __init__(self, users):
        self.users = users
        self.failed_attempts: dict[str, int] = {}

    def login(self, email: str, password: str) -> str:
        user = self.users.find_by_email(email)
        if not user or not check_password(password, user.password_hash):
            self.failed_attempts[email] = self.failed_attempts.get(email, 0) + 1
            raise PermissionError("invalid email or password")
        self.failed_attempts.pop(email, None)
        return issue_token(user.id, user.role)

    def is_locked_out(self, email: str) -> bool:
        """Block an account after five failed logins in a row."""
        return self.failed_attempts.get(email, 0) >= 5

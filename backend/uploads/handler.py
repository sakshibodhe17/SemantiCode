"""
File upload handling.

Validates and persists files uploaded through the API (for example, a
user's avatar, or — in the semantic search product itself — a project
ZIP archive for the optional "import repository" flow described in
the project scope).
"""

import os
import uuid
from pathlib import Path

ALLOWED_EXTENSIONS = {".zip", ".png", ".jpg", ".jpeg", ".pdf"}
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", Path(__file__).resolve().parent / "files"))


def validate_upload(filename: str, size_bytes: int) -> None:
    """Raise ValueError if the upload fails basic validation checks."""
    extension = Path(filename).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {extension}")

    if size_bytes > MAX_UPLOAD_SIZE_BYTES:
        raise ValueError("File exceeds maximum upload size of 50MB")


def save_upload(filename: str, content: bytes) -> str:
    """
    Validate and save an uploaded file to disk.

    Returns the generated storage path. Files are stored under a random
    UUID-derived name so user-supplied filenames never collide or allow
    path traversal.
    """
    validate_upload(filename, len(content))

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    extension = Path(filename).suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{extension}"
    destination = UPLOAD_DIR / stored_name

    with open(destination, "wb") as f:
        f.write(content)

    return str(destination)


def delete_upload(stored_path: str) -> None:
    """Remove a previously saved upload from disk, if it exists."""
    path = Path(stored_path)
    if path.exists() and path.is_relative_to(UPLOAD_DIR):
        path.unlink()

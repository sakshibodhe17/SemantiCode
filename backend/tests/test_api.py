"""End-to-end API tests with FastAPI's TestClient (uses a temporary SQLite DB)."""
import importlib
import io
import os
import zipfile
from pathlib import Path

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

BACKEND = Path(__file__).resolve().parents[1]


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    import backend.db.connection as connection
    importlib.reload(connection)
    for module in ("backend.auth.service", "backend.routes.auth", "backend.routes.search", "backend.main"):
        importlib.reload(importlib.import_module(module))
    from fastapi.testclient import TestClient
    from backend.main import app
    with TestClient(app) as c:
        yield c


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_index_search_history(client):
    r = client.post("/api/index", json={"workspace_id": "demo", "path": str(BACKEND)})
    assert r.status_code == 200 and r.json()["chunks_indexed"] > 10
    r = client.post("/api/search", json={"workspace_id": "demo", "query": "in:auth JWT token created", "top_k": 3})
    body = r.json()
    assert r.status_code == 200 and body["results"][0]["name"] == "create_access_token"
    assert body["results"][0]["matched"]
    assert client.get("/api/search/history/demo").json()[0]["query"] == "in:auth JWT token created"


def test_search_unindexed_workspace_is_404(client):
    r = client.post("/api/search", json={"workspace_id": "nope", "query": "anything"})
    assert r.status_code == 404


def test_register_login_me(client):
    assert client.post("/api/auth/register", json={"username": "sk", "email": "sk@example.com", "password": "secret123"}).status_code == 201
    assert client.post("/api/auth/login", json={"username": "sk", "password": "wrong"}).status_code == 401
    token = client.post("/api/auth/login", json={"username": "sk", "password": "secret123"}).json()["access_token"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["username"] == "sk"
    assert client.get("/api/auth/me").status_code == 401


def test_zip_upload_and_zip_slip_protection(client):
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("proj/app.py", "def send_email(to):\n    '''Send a welcome email.'''\n    return smtp.send(to)\n")
    r = client.post("/api/repositories/upload", data={"workspace_id": "zipdemo"},
                    files={"file": ("proj.zip", buf.getvalue(), "application/zip")})
    assert r.status_code == 200 and r.json()["functions"] == 1
    hits = client.post("/api/search", json={"workspace_id": "zipdemo", "query": "mail notification"}).json()["results"]
    assert hits[0]["name"] == "send_email"

    evil = io.BytesIO()
    with zipfile.ZipFile(evil, "w") as z:
        z.writestr("../../escape.py", "x = 1\n")
    r = client.post("/api/repositories/upload", data={"workspace_id": "evil"},
                    files={"file": ("evil.zip", evil.getvalue(), "application/zip")})
    assert r.status_code == 400

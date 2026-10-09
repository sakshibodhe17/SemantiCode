"""Runnable FastAPI application for SemantiCode.

Start from the repository root:
    python -m uvicorn backend.main:app --reload --port 8000
Interactive docs: http://127.0.0.1:8000/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db.connection import check_connection, migrate_schema
from backend.models.user import Base
from backend.routes import auth, search


@asynccontextmanager
async def lifespan(_: FastAPI):
    migrate_schema(Base)
    yield


app = FastAPI(
    title="SemantiCode API",
    version="1.0.0",
    description="Index a codebase into functions/classes and search it in natural language.",
    lifespan=lifespan,
)
# The VS Code extension calls the API from the extension host (Node), which is
# not subject to CORS; these origins cover the Vite dev server and webviews.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"^vscode-webview://.*$",
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router)
app.include_router(search.router)


@app.get("/health")
def health():
    ok = check_connection()
    return {"status": "ok" if ok else "degraded", "database": "connected" if ok else "unavailable"}

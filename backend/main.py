"""Runnable FastAPI application for SemantiCode."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.db.connection import check_connection, engine
from backend.models.user import Base
from backend.routes import auth, search


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="SemantiCode API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "vscode-webview://*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(search.router)


@app.get("/health")
def health():
    return {"status": "ok" if check_connection() else "degraded", "database": "connected" if check_connection() else "unavailable"}

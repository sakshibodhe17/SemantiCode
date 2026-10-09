"""Index, search, status, history and repository-upload endpoints."""
from __future__ import annotations

import shutil
import tempfile
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from backend.db.connection import get_db_session
from backend.models.user import CodeChunk, SearchHistory, Workspace
from backend.schemas.search import IndexRequest, SearchRequest
from backend.services.indexer import collect_chunks
from backend.services.search_engine import build_search_text, rank

router = APIRouter(prefix="/api", tags=["semantic-search"])

UPLOAD_ROOT = Path(__file__).resolve().parents[1] / "uploads" / "repositories"
MAX_ZIP_BYTES = 50 * 1024 * 1024


def _store_index(workspace_id: str, path: str, file_count: int, chunks: list[dict]) -> dict:
    """Replace a workspace's chunks in one transaction."""
    with get_db_session() as session:
        session.query(CodeChunk).filter(CodeChunk.workspace_id == workspace_id).delete()
        workspace = session.get(Workspace, workspace_id) or Workspace(id=workspace_id, path=path)
        workspace.path = path
        workspace.indexed_at = datetime.now(timezone.utc)
        workspace.file_count = file_count
        workspace.chunk_count = len(chunks)
        session.add(workspace)
        session.add_all([
            CodeChunk(
                workspace_id=workspace_id,
                file_path=c["file"],
                symbol_name=c["name"],
                symbol_type=c["type"],
                class_name=c.get("class_name"),
                language=c.get("language", ""),
                start_line=c["start"],
                end_line=c["end"],
                content=c["content"],
                search_text=build_search_text(c["name"], c.get("class_name"), c["file"], c.get("doc", ""), c["content"]),
            )
            for c in chunks
        ])
        session.commit()
    functions = sum(1 for c in chunks if c["type"] in ("function", "method"))
    classes = sum(1 for c in chunks if c["type"] == "class")
    return {"workspace_id": workspace_id, "files_indexed": file_count, "chunks_indexed": len(chunks),
            "functions": functions, "classes": classes}


@router.post("/index")
def index_workspace(payload: IndexRequest):
    """Index a folder on the machine running the API (the developer's own machine)."""
    started = time.perf_counter()
    try:
        file_count, chunks = collect_chunks(payload.path)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    result = _store_index(payload.workspace_id, str(Path(payload.path).resolve()), file_count, chunks)
    result["seconds"] = round(time.perf_counter() - started, 3)
    return result


@router.post("/repositories/upload")
async def upload_repository(workspace_id: str = Form(..., min_length=1, max_length=120),
                            file: UploadFile = File(...)):
    """Optional 'import repository' flow: upload a .zip of a project and index it."""
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(status_code=415, detail="Upload a .zip archive of the repository")
    data = await file.read()
    if len(data) > MAX_ZIP_BYTES:
        raise HTTPException(status_code=413, detail="Archive exceeds 50 MB")

    safe_id = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in workspace_id)
    target = UPLOAD_ROOT / safe_id
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    with tempfile.TemporaryFile() as tmp:
        tmp.write(data)
        tmp.seek(0)
        try:
            with zipfile.ZipFile(tmp) as archive:
                for member in archive.infolist():
                    destination = (target / member.filename).resolve()
                    # Zip-slip protection: never write outside the target folder.
                    if not destination.is_relative_to(target.resolve()):
                        raise HTTPException(status_code=400, detail=f"Unsafe path in archive: {member.filename}")
                archive.extractall(target)
        except zipfile.BadZipFile as error:
            raise HTTPException(status_code=400, detail="Not a valid zip archive") from error

    file_count, chunks = collect_chunks(str(target))
    return _store_index(workspace_id, str(target), file_count, chunks)


@router.post("/search")
def search(payload: SearchRequest):
    started = time.perf_counter()
    with get_db_session() as session:
        chunks = session.query(CodeChunk).filter(CodeChunk.workspace_id == payload.workspace_id).all()
        if not chunks:
            raise HTTPException(status_code=404, detail="Workspace is not indexed. Call POST /api/index first.")
        ranked = rank(
            payload.query,
            [c.search_text for c in chunks],
            [{"language": c.language or "", "file": c.file_path, "kind": c.symbol_type} for c in chunks],
            payload.top_k,
            expand=payload.expand,
        )
        results = []
        for r in ranked:
            c = chunks[r.index]
            results.append({
                "id": str(c.id), "similarity": r.relevance, "name": c.symbol_name,
                "className": c.class_name, "kind": c.symbol_type, "language": c.language or "",
                "file": c.file_path, "startLine": c.start_line, "endLine": c.end_line,
                "code": c.content.splitlines(), "matched": r.matched,
            })
        session.add(SearchHistory(workspace_id=payload.workspace_id, query=payload.query, result_count=len(results)))
        session.commit()
    return {"results": results, "elapsed_ms": round((time.perf_counter() - started) * 1000, 1)}


@router.get("/workspace/{workspace_id}/status")
def workspace_status(workspace_id: str):
    with get_db_session() as session:
        workspace = session.get(Workspace, workspace_id)
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace has not been indexed")
        return {"workspace_id": workspace.id, "path": workspace.path, "status": "ready",
                "file_count": workspace.file_count, "chunk_count": workspace.chunk_count,
                "indexed_at": workspace.indexed_at}


@router.get("/workspaces")
def list_workspaces():
    """All indexed repositories (used by an admin view)."""
    with get_db_session() as session:
        rows = session.query(Workspace).order_by(Workspace.indexed_at.desc()).all()
        return [{"workspace_id": w.id, "path": w.path, "file_count": w.file_count,
                 "chunk_count": w.chunk_count, "indexed_at": w.indexed_at} for w in rows]


@router.delete("/workspace/{workspace_id}")
def delete_workspace(workspace_id: str):
    with get_db_session() as session:
        deleted = session.query(CodeChunk).filter(CodeChunk.workspace_id == workspace_id).delete()
        workspace = session.get(Workspace, workspace_id)
        if workspace:
            session.delete(workspace)
        session.commit()
    return {"workspace_id": workspace_id, "chunks_deleted": deleted}


@router.get("/search/history/{workspace_id}")
def history(workspace_id: str, limit: int = 50):
    with get_db_session() as session:
        rows = (session.query(SearchHistory)
                .filter(SearchHistory.workspace_id == workspace_id)
                .order_by(SearchHistory.searched_at.desc())
                .limit(max(1, min(limit, 200))).all())
        return [{"query": r.query, "result_count": r.result_count, "searched_at": r.searched_at} for r in rows]
